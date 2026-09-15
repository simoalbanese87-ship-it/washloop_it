"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

const REV = "/admin/lavanderia";

/** Segna come pagato tutto il dovuto a una lavanderia per un mese.
 *
 *  Due stati e non quattro: "maturato" e "pagato". Un flusso con verifica,
 *  approvazione e pagamento avrebbe senso con decine di partner e migliaia di
 *  righe; con una lavanderia sarebbe una procedura da compilare per finta.
 *
 *  Non tocca le righe annullate (`void`): un capo rimosso o rimborsato non si
 *  paga, e riportarlo in vita per errore sarebbe denaro regalato. */
export async function segnaMesePagato(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const laundryId = String(formData.get("laundry_id") ?? "");
  const mese = String(formData.get("mese") ?? ""); // YYYY-MM
  if (!laundryId || !/^\d{4}-\d{2}$/.test(mese)) {
    redirect(`${REV}?warn=${encodeURIComponent("Periodo non valido.")}`);
  }

  // Gli estremi si scrivono come date, non come istanti: `servizio_il` è un
  // giorno, e confrontarlo con un timestamp UTC farebbe cadere fuori l'ultimo
  // giorno del mese a seconda del fuso.
  const inizio = `${mese}-01`;
  const [anno, m] = mese.split("-").map(Number);
  const fine = `${m === 12 ? anno + 1 : anno}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;

  const svc = createServiceClient();
  const { error, count } = await svc
    .from("laundry_payouts")
    // La data del pagamento, non solo il fatto: la lavanderia deve poterla
    // confrontare con l'estratto conto. «Pagato» senza quando non si verifica.
    .update({ status: "settled", paid_at: new Date().toISOString() }, { count: "exact" })
    .eq("laundry_id", laundryId)
    .eq("status", "pending")
    // Sul mese del servizio, esattamente come la pagina che si sta guardando:
    // se i due criteri divergessero, il bottone liquiderebbe righe diverse da
    // quelle del totale appena letto.
    .gte("servizio_il", inizio)
    .lt("servizio_il", fine);

  if (error) redirect(`${REV}?warn=${encodeURIComponent(error.message)}`);

  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent(`Segnate come pagate ${count ?? 0} voci di ${mese}.`)}`);
}
