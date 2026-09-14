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
  const inv = await sk.invoices.retrieve(invoiceId, { expand: ["payments"] });
  if (inv.status !== "paid") return null;

  const id = (v: unknown): string | null =>
    typeof v === "string" ? v : v && typeof v === "object" && "id" in v ? String((v as { id: string }).id) : null;

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

  return null;
}
