"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { registraIncasso } from "@/lib/fatturazione";
import { ficMode } from "@/lib/fic";
import { importaIncassiDaStripe } from "@/lib/incassi-import";

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
