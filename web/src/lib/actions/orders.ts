"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/orders";

/** Cliente: crea un ordine prenotando uno slot di ritiro. */
export async function createPickup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const address_id = String(formData.get("address_id") ?? "");
  const pickup_slot_id = String(formData.get("pickup_slot_id") ?? "");
  const bags = Number(formData.get("bags") ?? 1);
  if (!address_id || !pickup_slot_id) throw new Error("Indirizzo e slot obbligatori");

  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_id: user.id,
      address_id,
      pickup_slot_id,
      bags: Number.isFinite(bags) && bags > 0 ? bags : 1,
      notes: String(formData.get("notes") ?? "") || null,
      status: "pickup_scheduled" as OrderStatus,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/app");
  redirect(`/app/ordini/${data!.id}`);
}

/** Cliente: prenota lo slot di consegna (disponibile da status=ready). */
export async function bookDelivery(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const delivery_slot_id = String(formData.get("delivery_slot_id") ?? "");
  if (!id || !delivery_slot_id) throw new Error("Slot consegna obbligatorio");

  const { error } = await supabase
    .from("orders")
    .update({ delivery_slot_id, status: "delivery_scheduled" as OrderStatus })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/ordini/${id}`);
}

/** Staff/admin: avanza lo stato dell'ordine. Il trigger DB logga l'evento. */
export async function advanceStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!id || !status) throw new Error("Parametri mancanti");

  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/ordini/${id}`);
  revalidatePath("/admin");
  revalidatePath("/courier");
}

/** Corriere: avanza stato + opzionale nota foto prova (URL già caricato su Storage). */
export async function courierAdvance(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const proofUrl = String(formData.get("proof_url") ?? "") || null;
  if (!id || !status) throw new Error("Parametri mancanti");

  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  if (proofUrl) {
    await supabase.from("order_items").insert({ order_id: id, kind: "prova", photo_url: proofUrl });
  }
  revalidatePath("/courier");
}

/** Admin: assegna corriere e lavanderia. */
export async function assignOrder(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const courier_id = String(formData.get("courier_id") ?? "") || null;
  const laundry_id = String(formData.get("laundry_id") ?? "") || null;

  const { error } = await supabase.from("orders").update({ courier_id, laundry_id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/ordini/${id}`);
}
