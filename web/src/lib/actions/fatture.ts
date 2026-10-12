"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { registraIncasso } from "@/lib/fatturazione";
import { ficMode } from "@/lib/fic";
import { importaIncassiDaStripe } from "@/lib/incassi-import";
import { origineDelPagamento } from "@/lib/pagamento-fattura";
import { stripe } from "@/lib/stripe";

const REV = "/admin/incassi";

/** Riprova a emettere una fattura rimasta indietro o finita in errore.
 *
 *  Serve perché il primo tentativo avviene dentro il webhook di Stripe, dove un
 *  problema di rete o un dato mancante non deve bloccare nulla: l'errore resta
 *  scritto sulla riga e da qui si ritenta a mente fredda, dopo aver corretto il
 *  dato che mancava. */
export async function riemettiFattura(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  if (ficMode() === "off") redirect(`${REV}?warn=${encodeURIComponent("Ponte spento: imposta FIC_MODE per emettere.")}`);

  const id = String(formData.get("id") ?? "");
  const svc = createServiceClient();
  const { data: riga } = await svc
    .from("invoices")
    .select("id, stripe_invoice_id, stripe_customer_id, amount_cents, user_id, created_at, fic_document_id")
    .eq("id", id)
    .maybeSingle<{
      id: string; stripe_invoice_id: string | null; stripe_customer_id: string | null;
      amount_cents: number; user_id: string | null; created_at: string; fic_document_id: number | null;
    }>();

  if (!riga?.stripe_invoice_id || !riga.stripe_customer_id) {
    redirect(`${REV}?warn=${encodeURIComponent("Incasso non trovato.")}`);
  }
  if (riga.fic_document_id) {
    redirect(`${REV}?warn=${encodeURIComponent("Già fatturato: nessuna doppia emissione.")}`);
  }

  await registraIncasso({
    stripeInvoiceId: riga.stripe_invoice_id,
    stripeCustomerId: riga.stripe_customer_id,
    amountCents: riga.amount_cents,
    userId: riga.user_id,
    descrizione: "Abbonamento WashLoop",
    dataIso: riga.created_at.slice(0, 10),
  });

  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent("Tentativo eseguito: controlla lo stato qui sotto.")}`);
}

/** Importa da Stripe gli incassi che il registro non ha mai visto.
 *
 *  Serve quando il webhook `invoice.payment_succeeded` non arriva — perché
 *  quell'evento non è attivo sull'endpoint, o perché è stato attivato dopo che
 *  i primi pagamenti erano già avvenuti. In pannello si vedeva "incassato
 *  €0,00" con i soldi già sul conto.
 *
 *  L'esito è anche la diagnosi: se trova incassi che non avevamo, il webhook va
 *  sistemato, altrimenti fra un mese servirà di nuovo. */
export async function importaIncassi() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const esito = await importaIncassiDaStripe();
  revalidatePath(REV);
  revalidatePath("/admin");

  if (esito.errore) {
    redirect(`${REV}?warn=${encodeURIComponent(`Importazione non riuscita: ${esito.errore}`)}`);
  }
  if (esito.lette === 0) {
    redirect(`${REV}?warn=${encodeURIComponent("Su Stripe non risulta nessuna fattura pagata. Il registro è a zero perché non è ancora entrato niente, non perché si è perso qualcosa.")}`);
  }
  const euro = (c: number) => "€" + (c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const messaggio =
    esito.scritte > 0
      ? `Importati ${esito.scritte} incassi che mancavano, su ${esito.lette} fatture pagate trovate su Stripe (${euro(esito.totaleCents)} in tutto). Sono entrati come ricevute: nessun documento è stato emesso su Fatture in Cloud. Erano fuori dal registro, quindi controlla che sull'endpoint Stripe sia attivo l'evento invoice.payment_succeeded, altrimenti i prossimi si perderanno di nuovo.`
      : `Nessuna riga da aggiungere: le ${esito.lette} fatture pagate su Stripe (${euro(esito.totaleCents)}) erano già tutte registrate. Nessun documento emesso su Fatture in Cloud.`;
  redirect(`${REV}?ok=${encodeURIComponent(messaggio)}`);
}

/** Rimborsa un incasso, in tutto o in parte, dal pannello.
 *
 *  Finora i rimborsi sugli incassi si potevano fare solo dalla dashboard di
 *  Stripe: il registro li registrava (il webhook `charge.refunded` scrive
 *  `rimborsato_at`), ma iniziarli no. Il 12 ottobre 2026 serviva restituire
 *  4,00 € a una cliente che passa a un altro servizio, e l'unica strada era
 *  entrare in Stripe con la password.
 *
 *  Il resto lo fa il webhook: questa funzione chiede il rimborso e scrive
 *  subito la riga, così il pannello non resta indietro se l'evento tarda. Le
 *  due scritture sono la stessa e non si pestano i piedi — `rimborsato_at` si
 *  scrive una volta sola. */
export async function rimborsaIncasso(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const id = String(formData.get("id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  const quanti = String(formData.get("importo_eur") ?? "").replace(",", ".").trim();
  if (!id) redirect(`${REV}?warn=${encodeURIComponent("Incasso mancante.")}`);

  const svc = createServiceClient();
  const { data: riga } = await svc
    .from("invoices")
    .select("id, user_id, amount_cents, stripe_invoice_id, rimborsato_at, rimborsato_cents, numero_ricevuta")
    .eq("id", id)
    .maybeSingle<{ id: string; user_id: string | null; amount_cents: number; stripe_invoice_id: string | null; rimborsato_at: string | null; rimborsato_cents: number | null; numero_ricevuta: number | null }>();
  if (!riga) redirect(`${REV}?warn=${encodeURIComponent("Incasso non trovato.")}`);
  // Un rimborso parziale non chiude la ricevuta.
  //
  // Prima bastava `rimborsato_at` per dichiararla chiusa: resi 4,00 € su 60,00
  // e gli altri 56,00 € non si potevano più toccare dal pannello. Succede
  // davvero — prima si rende la quota dei giorni non usati, poi salta anche un
  // ritiro e va reso pure quello. Quello che conta è quanto resta.
  const giaReso = riga!.rimborsato_cents ?? 0;
  const residuo = riga!.amount_cents - giaReso;
  if (residuo <= 0) {
    redirect(`${REV}?warn=${encodeURIComponent("Questo incasso è già stato rimborsato per intero.")}`);
  }
  if (!riga!.stripe_invoice_id) redirect(`${REV}?warn=${encodeURIComponent("Incasso senza fattura Stripe: va rimborsato a mano.")}`);

  // Importo vuoto = tutto. Un importo scritto vale solo se sta dentro l'incasso:
  // un rimborso più grande dell'incasso Stripe lo rifiuta, ma è meglio dirlo qui.
  const parziale = quanti ? Math.round(parseFloat(quanti) * 100) : residuo;
  if (!Number.isFinite(parziale) || parziale <= 0 || parziale > residuo) {
    redirect(
      `${REV}?warn=` +
        encodeURIComponent(
          giaReso > 0
            ? `Importo non valido: su questa ricevuta restano ${(residuo / 100).toFixed(2)} € (già resi ${(giaReso / 100).toFixed(2)} €).`
            : `Importo non valido: dev'essere fra 0,01 € e ${(residuo / 100).toFixed(2)} €.`,
        ),
    );
  }

  const origine = await origineDelPagamento(riga!.stripe_invoice_id!);
  if (!origine) {
    redirect(`${REV}?warn=${encodeURIComponent(`Non trovo il pagamento della fattura ${riga!.stripe_invoice_id}: nessun rimborso è stato fatto.`)}`);
  }

  let refundId: string;
  try {
    const refund = await stripe().refunds.create(
      origine!.tipo === "payment_intent"
        ? { payment_intent: origine!.id, amount: parziale }
        : { charge: origine!.id, amount: parziale },
    );
    refundId = refund.id;
  } catch (err) {
    redirect(`${REV}?warn=${encodeURIComponent(`Rimborso rifiutato da Stripe: ${err instanceof Error ? err.message : "errore"}`)}`);
  }

  // Il totale reso si somma: due rimborsi su una ricevuta sono due gesti, ma
  // una cifra sola — ed è quella che poi si legge in contabilità.
  await svc
    .from("invoices")
    .update({ rimborsato_at: new Date().toISOString(), rimborsato_cents: giaReso + parziale })
    .eq("id", id);

  // Anche nella scheda del cliente, dove si legge la storia dei suoi soldi.
  if (riga!.user_id) {
    await svc.from("customer_charges").insert({
      customer_id: riga!.user_id,
      description: `Rimborso ricevuta n. ${riga!.numero_ricevuta ?? "—"}${motivo ? ` · ${motivo}` : ""}`,
      amount_cents: parziale,
      kind: "refund",
      status: "settled",
      stripe_ref: refundId!,
      created_by: me.id,
    });
    revalidatePath(`/admin/abbonati/${riga!.user_id}`);
  }

  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent(`Rimborsati ${(parziale / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}.`)}`);
}
