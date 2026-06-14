"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

/** Annulla l'ordine. */
export async function cancelOrder(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const { error } = await supabase.from("orders").update({ status: "cancelled" as OrderStatus }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/ordini/${id}`);
  revalidatePath("/admin");
}
