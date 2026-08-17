"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { registraIncasso } from "@/lib/fatturazione";
import { ficMode } from "@/lib/fic";

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
