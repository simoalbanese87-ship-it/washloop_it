"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createZone(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome zona obbligatorio");
  const { error } = await supabase.from("zones").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/catalogo");
}

export async function createLaundry(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome lavanderia obbligatorio");
  const { error } = await supabase.from("laundries").insert({
    name,
    zone_id: String(formData.get("zone_id") ?? "") || null,
    address: String(formData.get("address") ?? "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/catalogo");
}

export async function createSlot(formData: FormData) {
  const supabase = await createClient();
  const date = String(formData.get("date") ?? "");
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!date || !from || !to) throw new Error("Data e orari obbligatori");

  const { error } = await supabase.from("slots").insert({
    zone_id: String(formData.get("zone_id") ?? "") || null,
    laundry_id: String(formData.get("laundry_id") ?? "") || null,
    kind: String(formData.get("kind") ?? "pickup"),
    starts_at: new Date(`${date}T${from}`).toISOString(),
    ends_at: new Date(`${date}T${to}`).toISOString(),
    capacity: Number(formData.get("capacity") ?? 10) || 10,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/catalogo");
}

/** Collega un piano al Price ID di Stripe (necessario per il Checkout). */
export async function updatePlanPrice(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("plan_id") ?? "");
  const stripe_price_id = String(formData.get("stripe_price_id") ?? "").trim() || null;
  const { error } = await supabase.from("plans").update({ stripe_price_id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/catalogo");
}
