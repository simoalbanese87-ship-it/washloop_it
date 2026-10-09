import "server-only";
import { stripe } from "@/lib/stripe";

/** Da dove si rimborsa una fattura Stripe già pagata.
 *
 *  Il difetto che risolve
 *  ----------------------
 *  Il codice leggeva `invoice.payment_intent` e `invoice.charge`. Nelle
 *  versioni recenti dell'API quei campi **non esistono più** sulla fattura: il
 *  pagamento sta in `invoice.payments`, che è una lista — una fattura può
 *  essere saldata in più tranche.
 *
 *  Leggendo un campo che non c'è si ottiene `undefined`, non un errore. Il
 *  rimborso veniva quindi saltato in silenzio: la riga risultava «rimborsata»,
 *  il compenso alla lavanderia veniva azzerato, e **i soldi del cliente
 *  restavano nostri**. È successo con le 3 camicie di Giulia, 10,50 €.
 *
 *  Un rimborso che non rimborsa è peggio di un rimborso che fallisce: il
 *  secondo si vede.
 *
 *  Restituisce l'identificativo da usare con `refunds.create`, oppure `null` se
 *  la fattura non risulta pagata — e allora non c'è niente da restituire. */
export type OrigineRimborso =
  | { tipo: "payment_intent"; id: string }
  | { tipo: "charge"; id: string };

export async function origineDelPagamento(invoiceId: string): Promise<OrigineRimborso | null> {
  const sk = stripe();

  const id = (v: unknown): string | null =>
    typeof v === "string" ? v : v && typeof v === "object" && "id" in v ? String((v as { id: string }).id) : null;

  // 1. La strada maestra: la lista dei pagamenti della fattura, che è una
  //    risorsa a sé (`/v1/invoice_payments`). Si chiede direttamente invece di
  //    sperare che arrivi dentro la fattura: l'`expand` dipende dalla versione
  //    dell'API, questa no. Il 9 ottobre 2026 l'`expand` ha restituito una
  //    fattura senza pagamenti e il rimborso di 14,00 € a Elvira non è partito.
  try {
    const pagamenti = await sk.invoicePayments.list({ invoice: invoiceId, limit: 10 });
    for (const p of pagamenti.data) {
      if (p.status !== "paid") continue;
      const pi = id(p.payment?.payment_intent);
      if (pi) return { tipo: "payment_intent", id: pi };
      const ch = id(p.payment?.charge);
      if (ch) return { tipo: "charge", id: ch };
    }
  } catch {
    // Versione dell'API che non conosce questa risorsa: si prova dalla fattura.
  }

  const inv = await sk.invoices.retrieve(invoiceId, { expand: ["payments"] });

  for (const p of inv.payments?.data ?? []) {
    const pagamento = (p as unknown as { payment?: { payment_intent?: unknown; charge?: unknown } }).payment;
    const pi = id(pagamento?.payment_intent);
    if (pi) return { tipo: "payment_intent", id: pi };
    const ch = id(pagamento?.charge);
    if (ch) return { tipo: "charge", id: ch };
  }

  // Ripiego per le fatture vecchie, quando i campi stavano ancora sulla
  // fattura: non si butta via un rimborso solo perché il pagamento è di prima.
  const vecchia = inv as unknown as { payment_intent?: unknown; charge?: unknown };
  const pi = id(vecchia.payment_intent);
  if (pi) return { tipo: "payment_intent", id: pi };
  const ch = id(vecchia.charge);
  if (ch) return { tipo: "charge", id: ch };

  // 3. Ultima strada: il pagamento esiste ma non è agganciato alla fattura in
  //    nessuno dei modi sopra. Si cerca fra i PaymentIntent del cliente quello
  //    che porta questo numero di fattura.
  const cliente = typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
  if (cliente) {
    const intenti = await sk.paymentIntents.list({ customer: cliente, limit: 25 });
    for (const pi2 of intenti.data) {
      const suaFattura = (pi2 as unknown as { invoice?: unknown }).invoice;
      if (id(suaFattura) === invoiceId && pi2.status === "succeeded") {
        return { tipo: "payment_intent", id: pi2.id };
      }
    }
  }

  return null;
}
