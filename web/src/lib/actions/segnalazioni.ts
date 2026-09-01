"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notifySegnalazioneCliente } from "@/lib/notify";

/** Azioni dell'ops sulle segnalazioni della lavanderia.
 *
 *  Scrivono con il service role dopo il controllo di ruolo, come il resto del
 *  pannello: la policy admin su `order_issues` esiste comunque, ma la guardia
 *  vera è qui — una server action è raggiungibile da chiunque abbia una
 *  sessione, non solo da chi vede il pannello. */
async function soloAdmin() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  return me;
}

/** Pubblica la segnalazione: da qui in poi il cliente la vede e la riceve.
 *
 *  Serve per i danni in lavorazione, che nascono non pubblicati apposta. Il
 *  testo che si aggiunge qui è la parte che la lavanderia non poteva scrivere:
 *  cosa proponiamo al cliente. Viaggia insieme alla segnalazione, non dopo. */
export async function pubblicaSegnalazione(formData: FormData) {
  await soloAdmin();
  const id = String(formData.get("issue_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  if (!id) return;

  const svc = createServiceClient();
  const { data: prima } = await svc
    .from("order_issues")
    .select("published_at")
    .eq("id", id)
    .maybeSingle<{ published_at: string | null }>();
  // Già pubblicata: non si riavvisa. Un secondo «il capo si è rovinato» a
  // distanza di giorni, per la stessa cosa, si legge come un secondo danno.
  if (!prima || prima.published_at) return;

  const { error } = await svc.from("order_issues").update({ published_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);

  await notifySegnalazioneCliente(id);

  revalidatePath(`/admin/ordini/${orderId}`);
  revalidatePath(`/app/ordini/${orderId}`);
  revalidatePath("/admin");
}

/** Chiude la segnalazione: gestita, non deve più comparire tra quelle aperte.
 *  Non avvisa nessuno — è una nota nostra su una cosa già comunicata. */
export async function chiudiSegnalazione(formData: FormData) {
  const me = await soloAdmin();
  const id = String(formData.get("issue_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim() || null;
  if (!id) return;

  const svc = createServiceClient();
  const { error } = await svc
    .from("order_issues")
    .update({ resolved_at: new Date().toISOString(), resolved_by: me.id, resolution })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/ordini/${orderId}`);
  revalidatePath("/admin");
}
