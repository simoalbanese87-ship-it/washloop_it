"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addAddress(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const street = String(formData.get("street") ?? "").trim();
  if (!street) throw new Error("Indirizzo obbligatorio");

  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    label: String(formData.get("label") ?? "") || null,
    street,
    zone_id: String(formData.get("zone_id") ?? "") || null,
    intercom: String(formData.get("intercom") ?? "") || null,
    floor: String(formData.get("floor") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    access_mode: String(formData.get("access_mode") ?? "door") || "door",
    access_note: String(formData.get("access_note") ?? "") || null,
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
