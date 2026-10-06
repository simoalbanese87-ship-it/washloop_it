"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { accreditaPremio } from "@/lib/referral";

/** Accredita a mano un premio rimasto sospeso.
 *
 *  Un premio sospeso non è un errore: è un premio che al momento non aveva un
 *  canone su cui calcolarsi — chi aveva invitato era senza abbonamento. Spesso
 *  basta che si riabboni perché torni calcolabile, e questo bottone è il modo
 *  di dirlo al sistema invece di rifare i conti a mano. */
export async function accreditaPremioAdmin(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const id = String(formData.get("premio_id") ?? "");
  if (!id) return;

  const esito = await accreditaPremio(id);
  revalidatePath("/admin/inviti");
  if (!esito.ok) {
    revalidatePath("/admin/inviti");
  }
}
