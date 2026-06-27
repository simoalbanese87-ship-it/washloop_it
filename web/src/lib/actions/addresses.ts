"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addAddress(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const streetRaw = String(formData.get("street") ?? "").trim();
  if (!streetRaw) throw new Error("Indirizzo obbligatorio");
  // Città concatenata nello street (serviamo Milano; nessuna colonna città).
  const city = String(formData.get("city") ?? "").trim();
  const street = city ? `${streetRaw}, ${city}` : streetRaw;

  // Zona non più scelta dal cliente: auto-assegna la prima zona attiva (Milano)
  // per non rompere etichette admin/corriere.
  const { data: zone } = await supabase.from("zones").select("id").eq("active", true).order("name").limit(1).maybeSingle<{ id: string }>();
  const accessMode = String(formData.get("access_mode") ?? "door") || "door";

  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    label: String(formData.get("label") ?? "") || null,
    street,
    zone_id: zone?.id ?? null,
    intercom: String(formData.get("intercom") ?? "") || null,
    floor: String(formData.get("floor") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    access_mode: accessMode,
    access_note: String(formData.get("access_note") ?? "") || null,
    concierge_hours: accessMode === "concierge" ? String(formData.get("concierge_hours") ?? "") || null : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/indirizzi");
}

export async function deleteAddress(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/indirizzi");
}
