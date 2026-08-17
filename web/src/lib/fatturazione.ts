import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { creaFattura, ficMode } from "@/lib/fic";

/** Registra un incasso Stripe e, se il cliente ha chiesto la fattura, la emette.
 *
 *  Regime scelto dal commercialista: **ricevuta a tutti, fattura solo su
 *  richiesta**. La ricevuta parte già da sola con l'email di addebito; qui si
 *  emette il documento fiscale soltanto per chi ha compilato i propri dati e
 *  spuntato la richiesta.
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

  // Fattura solo a chi l'ha chiesta: per tutti gli altri la riga resta
  // "saltata", che non è un errore ma la normalità del regime scelto.
  if (!input.userId) return;
  const dati = await datiFatturazione(input.userId);
  if (!dati?.vuole) return;
  if (ficMode() === "off") {
    // Richiesta registrata ma ponte spento: la riga resta in attesa e si vede
    // in /admin/incassi, invece di sparire.
    await svc.from("invoices").update({ stato: "da_emettere", requested_at: new Date().toISOString() }).eq("id", riga.id);
    return;
  }

  const esito = await creaFattura({
    cliente: {
      nome: dati.nome,
      email: dati.email,
      indirizzo: dati.indirizzo,
      cap: dati.cap,
      citta: dati.citta,
      codiceFiscale: dati.codiceFiscale,
      partitaIva: dati.partitaIva,
      codiceDestinatario: dati.sdi,
      pec: dati.pec,
    },
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
            requested_at: new Date().toISOString(),
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

/** Dati fiscali del cliente, se ha chiesto la fattura.
 *
 *  Stanno sul profilo perché chi la chiede una volta la vuole anche ai rinnovi:
 *  si compilano una volta sola. Indirizzo di fatturazione facoltativo — se non
 *  lo indica, si usa quello di ritiro, che è comunque suo. */
async function datiFatturazione(userId: string) {
  const svc = createServiceClient();
  const [{ data: prof }, { data: addr }, { data: utente }] = await Promise.all([
    svc
      .from("profiles")
      .select("full_name, billing_wants_invoice, billing_name, billing_address, billing_cap, billing_city, billing_tax_code, billing_vat, billing_sdi, billing_pec")
      .eq("id", userId)
      .maybeSingle<{
        full_name: string | null; billing_wants_invoice: boolean;
        billing_name: string | null; billing_address: string | null; billing_cap: string | null; billing_city: string | null;
        billing_tax_code: string | null; billing_vat: string | null; billing_sdi: string | null; billing_pec: string | null;
      }>(),
    svc.from("addresses").select("street, civico, cap").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle<{ street: string; civico: string | null; cap: string | null }>(),
    svc.auth.admin.getUserById(userId),
  ]);
  if (!prof) return null;

  let indirizzoRitiro: string | undefined;
  if (addr?.street) {
    const via = addr.street.trim();
    const civico = addr.civico?.trim();
    indirizzoRitiro = civico && !via.endsWith(civico) ? `${via} ${civico}` : via;
  }

  return {
    vuole: prof.billing_wants_invoice === true,
    nome: prof.billing_name?.trim() || prof.full_name || "Cliente",
    email: utente?.user?.email ?? undefined,
    indirizzo: prof.billing_address?.trim() || indirizzoRitiro,
    cap: prof.billing_cap?.trim() || addr?.cap || undefined,
    citta: prof.billing_city?.trim() || "Milano",
    codiceFiscale: prof.billing_tax_code?.trim() || undefined,
    partitaIva: prof.billing_vat?.trim() || undefined,
    sdi: prof.billing_sdi?.trim() || undefined,
    pec: prof.billing_pec?.trim() || undefined,
  };
}
