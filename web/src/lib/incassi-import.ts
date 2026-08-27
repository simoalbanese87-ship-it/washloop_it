import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

/** Riempie il registro incassi con lo storico vero, letto da Stripe.
 *
 *  Il registro si popola dal webhook `invoice.payment_succeeded`. Se quel tipo
 *  di evento non è attivo sull'endpoint Stripe — si scelgono uno per uno — i
 *  soldi arrivano sul conto e noi non lo sappiamo: in pannello l'incassato
 *  resta a zero mentre i pagamenti ci sono stati. Questa funzione va a
 *  guardare Stripe, che sui soldi è la fonte del vero, e scrive le righe che
 *  mancano.
 *
 *  Due scelte deliberate:
 *
 *  - **Non emette niente di fiscale.** `registraIncasso` oltre a scrivere la
 *    riga può emettere la fattura via Fatture in Cloud: su uno storico
 *    significherebbe sfornare documenti retroattivi in silenzio. Le righe
 *    importate nascono "saltata", cioè solo ricevuta. Se su un vecchio incasso
 *    va emessa una fattura, lo decide una persona con il commercialista.
 *  - **Si può rilanciare.** L'id della fattura Stripe è unico in tabella e si
 *    usa come chiave: rieseguire non crea doppioni, aggiunge solo il nuovo.
 *
 *  Il numero di righe trovate è anche la diagnosi: se Stripe ha incassi che noi
 *  non avevamo, il problema era la configurazione del webhook e va sistemata,
 *  altrimenti l'importazione servirà di nuovo al prossimo pagamento. */

export type EsitoImport = {
  lette: number;
  scritte: number;
  giaPresenti: number;
  totaleCents: number;
  errore?: string;
};

/** Tetto di sicurezza: oltre non si va in una sola esecuzione. Con i volumi di
 *  oggi non si sfiora nemmeno; serve a non far scadere la richiesta il giorno
 *  in cui le fatture saranno migliaia. */
const MAX_FATTURE = 500;

export async function importaIncassiDaStripe(): Promise<EsitoImport> {
  const svc = createServiceClient();
  const esito: EsitoImport = { lette: 0, scritte: 0, giaPresenti: 0, totaleCents: 0 };

  // Da quale cliente Stripe risale a quale utente nostro. Una fattura di un
  // cliente che non abbiamo si registra lo stesso, senza utente: è comunque un
  // incasso, e sparirebbe dai totali.
  const { data: subs } = await svc
    .from("subscriptions")
    .select("user_id, stripe_customer_id")
    .not("stripe_customer_id", "is", null)
    .returns<{ user_id: string; stripe_customer_id: string }[]>();
  const utenteDi = new Map<string, string>();
  for (const s of subs ?? []) utenteDi.set(s.stripe_customer_id, s.user_id);

  // Quali fatture abbiamo già: una lettura sola invece di una per riga.
  const { data: esistenti } = await svc
    .from("invoices")
    .select("stripe_invoice_id")
    .returns<{ stripe_invoice_id: string | null }[]>();
  const gia = new Set((esistenti ?? []).map((r) => r.stripe_invoice_id).filter(Boolean) as string[]);

  const daScrivere: Record<string, unknown>[] = [];
  try {
    let dopo: string | undefined;
    while (esito.lette < MAX_FATTURE) {
      const pagina = await stripe().invoices.list({ status: "paid", limit: 100, starting_after: dopo });
      if (pagina.data.length === 0) break;

      for (const f of pagina.data) {
        esito.lette++;
        const importo = f.amount_paid ?? 0;
        if (importo <= 0) continue; // fatture a zero: non sono incassi
        if (!f.id) continue;
        esito.totaleCents += importo;
        if (gia.has(f.id)) {
          esito.giaPresenti++;
          continue;
        }
        const customerId = typeof f.customer === "string" ? f.customer : (f.customer?.id ?? null);
        daScrivere.push({
          stripe_invoice_id: f.id,
          stripe_customer_id: customerId,
          amount_cents: importo,
          user_id: customerId ? utenteDi.get(customerId) ?? null : null,
          // "saltata" = incassato, ricevuta e basta. Vedi sopra: niente
          // emissione fiscale retroattiva.
          stato: "saltata",
          created_at: new Date((f.status_transitions?.paid_at ?? f.created) * 1000).toISOString(),
        });
      }

      if (!pagina.has_more) break;
      dopo = pagina.data[pagina.data.length - 1]?.id;
      if (!dopo) break;
    }
  } catch (err) {
    // Chiave assente o Stripe irraggiungibile: si dice, non si finge un zero.
    return { ...esito, errore: err instanceof Error ? err.message : "Stripe non raggiungibile" };
  }

  if (daScrivere.length > 0) {
    const { error } = await svc.from("invoices").upsert(daScrivere, { onConflict: "stripe_invoice_id" });
    if (error) return { ...esito, errore: error.message };
    esito.scritte = daScrivere.length;
  }
  return esito;
}
