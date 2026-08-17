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

  const inizio = `${mese}-01T00:00:00.000Z`;
  const [anno, m] = mese.split("-").map(Number);
  const fine = new Date(Date.UTC(m === 12 ? anno + 1 : anno, m === 12 ? 0 : m, 1)).toISOString();

  const svc = createServiceClient();
  const { error, count } = await svc
    .from("laundry_payouts")
    .update({ status: "settled" }, { count: "exact" })
    .eq("laundry_id", laundryId)
    .eq("status", "pending")
    .gte("created_at", inizio)
    .lt("created_at", fine);

  if (error) redirect(`${REV}?warn=${encodeURIComponent(error.message)}`);

  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent(`Segnate come pagate ${count ?? 0} voci di ${mese}.`)}`);
}
