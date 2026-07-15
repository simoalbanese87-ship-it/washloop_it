"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { romeLocalToISO } from "@/lib/format";

const REV = "/admin/catalogo";

// ---------- ZONE ----------
export async function createZone(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome zona obbligatorio");
  const { error } = await supabase.from("zones").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function toggleZone(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const { error } = await supabase.from("zones").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function deleteZone(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("zones").delete().eq("id", id);
  if (error) throw new Error("Zona in uso, non eliminabile. Disattivala invece.");
  revalidatePath(REV);
}

/** Assegna (o rimuove) il rider dedicato di una zona. L'auto-assegnazione ordini
 *  manda alla zona il suo rider; le zone senza rider usano il fallback bilanciato. */
export async function setZoneCourier(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("zone_id") ?? "");
  const courier_id = String(formData.get("courier_id") ?? "") || null;
  const { error } = await supabase.from("zones").update({ courier_id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

// ---------- LAVANDERIE ----------
export async function createLaundry(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome lavanderia obbligatorio");
  const { error } = await supabase.from("laundries").insert({
    name,
    zone_id: String(formData.get("zone_id") ?? "") || null,
    address: String(formData.get("address") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function updateLaundry(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("Dati lavanderia mancanti");
  const { error } = await supabase
    .from("laundries")
    .update({
      name,
      zone_id: String(formData.get("zone_id") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      active: formData.has("active"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function deleteLaundry(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("laundries").delete().eq("id", id);
  if (error) throw new Error("Lavanderia in uso, non eliminabile. Disattivala invece.");
  revalidatePath(REV);
}

// ---------- PIANI ----------
export async function updatePlanPrice(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("plan_id") ?? "");
  const stripe_price_id = String(formData.get("stripe_price_id") ?? "").trim() || null;
  const { error } = await supabase.from("plans").update({ stripe_price_id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function updatePlan(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("plan_id") ?? "");
  const euro = Number(formData.get("price_eur") ?? 0);
  const { error } = await supabase
    .from("plans")
    .update({
      name: String(formData.get("name") ?? "").trim() || "Piano",
      price_month_cents: Number.isFinite(euro) ? Math.round(euro * 100) : 0,
      turnaround_hours: Number(formData.get("turnaround_hours") ?? 48) || 48,
      pickups_per_week: Number(formData.get("pickups_per_week") ?? 1) || 1,
      active: formData.has("active"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

// ---------- SLOT ----------
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
    starts_at: romeLocalToISO(`${date}T${from}`),
    ends_at: romeLocalToISO(`${date}T${to}`),
    capacity: Number(formData.get("capacity") ?? 10) || 10,
  });
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function deleteSlot(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("slot_id") ?? "");
  const { error } = await supabase.from("slots").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

/** Genera slot ricorrenti per una lavanderia su un intervallo, giorni e fasce. */
export async function generateSlots(formData: FormData) {
  const supabase = await createClient();
  const laundry_id = String(formData.get("laundry_id") ?? "");
  if (!laundry_id) throw new Error("Lavanderia obbligatoria");
  const kind = String(formData.get("kind") ?? "pickup");
  const date_from = String(formData.get("date_from") ?? "");
  const date_to = String(formData.get("date_to") ?? "");
  const capacity = Number(formData.get("capacity") ?? 10) || 10;
  const days = formData.getAll("days").map(String);
  const windows = [
    [String(formData.get("w1_from") ?? ""), String(formData.get("w1_to") ?? "")],
    [String(formData.get("w2_from") ?? ""), String(formData.get("w2_to") ?? "")],
  ].filter(([a, b]) => a && b);

  if (!date_from || !date_to || days.length === 0) throw new Error("Date e giorni obbligatori");
  if (windows.length === 0) throw new Error("Inserisci almeno una fascia oraria");

  const { data: lab } = await supabase.from("laundries").select("zone_id").eq("id", laundry_id).maybeSingle<{ zone_id: string | null }>();
  const zone_id = lab?.zone_id ?? null;

  const start = new Date(`${date_from}T00:00:00Z`);
  const end = new Date(`${date_to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) throw new Error("Intervallo date non valido");

  const rows: Array<Record<string, unknown>> = [];
  const d = new Date(start);
  for (let i = 0; d <= end && i < 90; d.setUTCDate(d.getUTCDate() + 1), i++) {
    if (!days.includes(String(d.getUTCDay()))) continue;
    const ds = d.toISOString().slice(0, 10);
    for (const [from, to] of windows) {
      rows.push({ laundry_id, zone_id, kind, starts_at: romeLocalToISO(`${ds}T${from}`), ends_at: romeLocalToISO(`${ds}T${to}`), capacity });
    }
  }
  if (rows.length === 0) throw new Error("Nessuno slot da creare con questi criteri");
  if (rows.length > 500) throw new Error("Troppi slot: riduci l'intervallo o le fasce");

  const { error } = await supabase.from("slots").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}
