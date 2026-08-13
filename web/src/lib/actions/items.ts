"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notifyOrderStatus } from "@/lib/notify";
import type { ItemStatus, OrderStatus } from "@/lib/orders";

/** Aggiunge un capo all'ordine (tipo + stato + foto opzionale). */
export async function addItem(formData: FormData) {
  const supabase = await createClient();
  const order_id = String(formData.get("order_id") ?? "");
  const kind = String(formData.get("kind") ?? "").trim();
  if (!order_id || !kind) throw new Error("Tipo capo obbligatorio");

  const { error } = await supabase.from("order_items").insert({
    order_id,
    kind,
    status: (String(formData.get("status") ?? "received") as ItemStatus),
    photo_url: String(formData.get("photo_url") ?? "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/ordini/${order_id}`);
  revalidatePath(`/app/ordini/${order_id}`);
}

export async function updateItemStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("item_id") ?? "");
  const order_id = String(formData.get("order_id") ?? "");
  const status = String(formData.get("status") ?? "") as ItemStatus;
  const { error } = await supabase.from("order_items").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/ordini/${order_id}`);
  revalidatePath(`/app/ordini/${order_id}`);
}

export async function deleteItem(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("item_id") ?? "");
  const order_id = String(formData.get("order_id") ?? "");
  const { error } = await supabase.from("order_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/ordini/${order_id}`);
}

/** Note interne staff (non visibili al cliente). */
export async function setStaffNotes(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const staff_notes = String(formData.get("staff_notes") ?? "") || null;
  const { error } = await supabase.from("orders").update({ staff_notes }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/ordini/${id}`);
}

/** Annulla l'ordine: resta in archivio, non sparisce. */
export async function cancelOrder(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const { error } = await supabase.from("orders").update({ status: "cancelled" as OrderStatus }).eq("id", id);
  if (error) throw new Error(error.message);

  // Il testo dell'annullamento esisteva già in notify.ts ma non lo chiamava
  // nessuno: chi si vedeva annullare l'ordine non riceveva niente, e per lui
  // era indistinguibile da un ordine dimenticato.
  await notifyOrderStatus(id, "cancelled");

  revalidatePath(`/admin/ordini/${id}`);
  revalidatePath("/admin");
  revalidatePath(`/app/ordini/${id}`);
  revalidatePath("/courier");
}

/** Elimina l'ordine per sempre, con tutto il suo storico (capi, eventi, borse:
 *  cancellati a cascata). Serve per ripulire i dati di prova senza toccare il
 *  database a mano.
 *
 *  Volutamente ammessa solo su ordini chiusi o annullati: un ordine vivo si
 *  annulla, non si fa sparire — il cliente e il rider stanno ancora contando su
 *  quella riga. E solo admin: è l'unica operazione irreversibile del pannello. */
export async function deleteOrder(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const id = String(formData.get("order_id") ?? "");
  if (!id) redirect("/admin/ordini?warn=" + encodeURIComponent("Ordine non trovato."));

  const svc = createServiceClient();
  const { data: order } = await svc
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; status: OrderStatus }>();
  if (!order) redirect("/admin/ordini?warn=" + encodeURIComponent("Ordine non trovato."));

  const eliminabili: OrderStatus[] = ["delivered", "completed", "cancelled"];
  if (!eliminabili.includes(order!.status)) {
    redirect(
      `/admin/ordini/${id}?warn=` +
        encodeURIComponent("Puoi eliminare solo ordini consegnati, completati o annullati. Annullalo prima."),
    );
  }

  const { error } = await svc.from("orders").delete().eq("id", id);
  if (error) redirect(`/admin/ordini/${id}?warn=` + encodeURIComponent(`Eliminazione fallita: ${error.message}`));

  revalidatePath("/admin/ordini");
  revalidatePath("/admin/archivio");
  revalidatePath("/admin");
  redirect("/admin/archivio?ok=" + encodeURIComponent("Ordine eliminato definitivamente."));
}
