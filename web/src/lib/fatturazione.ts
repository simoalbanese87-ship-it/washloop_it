import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { creaFattura, ficMode } from "@/lib/fic";

/** Registra un incasso Stripe e, se il ponte è attivo, lo fattura su FIC.
 *
 *  La riga in `invoices` si scrive SEMPRE, anche a ponte spento: così il giorno
 *  in cui il commercialista dice come procedere, gli incassi già avvenuti sono
 *  tutti lì con il loro stato, e non c'è da ricostruirli a mano da Stripe.
 *
 *  Idempotente sull'id della fattura Stripe: Stripe ritenta i webhook per tre
 *  giorni, e due tentativi non devono produrre due fatture. Il vincolo è unico
 *  in tabella, quindi regge anche a due esecuzioni contemporanee. */
export async function registraIncasso(input: {
  stripeInvoiceId: string;
  stripeCustomerId: string;
  amountCents: number;
  userId?: string | null;
  descrizione: string;
  dataIso: string;
}): Promise<void> {
  const svc = createServiceClient();

  const { data: riga, error } = await svc
    .from("invoices")
    .upsert(
      {
        stripe_invoice_id: input.stripeInvoiceId,
        stripe_customer_id: input.stripeCustomerId,
        amount_cents: input.amountCents,
        user_id: input.userId ?? null,
        stato: "da_emettere",
      },
      { onConflict: "stripe_invoice_id", ignoreDuplicates: false },
    )
    .select("id, stato, fic_document_id")
    .maybeSingle<{ id: string; stato: string; fic_document_id: number | null }>();

  if (error) {
    console.error("[fatture] registrazione incasso fallita:", error.message);
    return;
  }
  // Già fatturato da un tentativo precedente: non si emette una seconda volta.
  if (!riga || riga.fic_document_id) return;
  if (ficMode() === "off") return;

  // Anagrafica per il documento. Quali campi siano obbligatori dipende dal
  // regime fiscale: qui mandiamo quello che abbiamo, e se FIC rifiuta il
  // documento l'errore resta scritto sulla riga, visibile in /admin.
  let nome = "Cliente";
  let email: string | undefined;
  let indirizzo: string | undefined;
  let cap: string | undefined;

  if (input.userId) {
    const [{ data: prof }, { data: addr }, { data: utente }] = await Promise.all([
      svc.from("profiles").select("full_name").eq("id", input.userId).maybeSingle<{ full_name: string | null }>(),
      svc.from("addresses").select("street, civico, cap").eq("user_id", input.userId).order("created_at", { ascending: false }).limit(1).maybeSingle<{ street: string; civico: string | null; cap: string | null }>(),
      svc.auth.admin.getUserById(input.userId),
    ]);
    if (prof?.full_name) nome = prof.full_name;
    email = utente?.user?.email ?? undefined;
    if (addr?.street) {
      const via = addr.street.trim();
      const civico = addr.civico?.trim();
      indirizzo = civico && !via.endsWith(civico) ? `${via} ${civico}` : via;
      cap = addr.cap ?? undefined;
    }
  }

  const esito = await creaFattura({
    cliente: { nome, email, indirizzo, cap, citta: "Milano" },
    descrizione: input.descrizione,
    // Gli importi Stripe sono IVA inclusa: l'imponibile si ricava scorporando.
    imponibileCents: Math.round(input.amountCents / 1.22),
    aliquotaIva: 22,
    data: input.dataIso,
  });

  await svc
    .from("invoices")
    .update(
      esito.ok
        ? {
            stato: "emessa",
            fic_document_id: esito.id,
            fic_number: esito.numero,
            fic_url: esito.url,
            ei_status: esito.eiStatus,
            errore: null,
            updated_at: new Date().toISOString(),
          }
        : { stato: "errore", errore: esito.errore, updated_at: new Date().toISOString() },
    )
    .eq("id", riga.id);

  if (!esito.ok) console.error(`[fatture] emissione fallita per ${input.stripeInvoiceId}:`, esito.errore);
}
