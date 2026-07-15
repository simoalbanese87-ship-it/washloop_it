"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { zoneIdForCap } from "@/lib/zones";

export async function addAddress(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const streetRaw = String(formData.get("street") ?? "").trim();
  const civico = String(formData.get("civico") ?? "").trim();
  if (!streetRaw) throw new Error("Via obbligatoria");
  if (!civico) throw new Error("Numero civico obbligatorio");

  const accessMode = String(formData.get("access_mode") ?? "door") || "door";
  const intercom = String(formData.get("intercom") ?? "").trim();
  const floor = String(formData.get("floor") ?? "").trim();
  const accessNote = String(formData.get("access_note") ?? "").trim();
  const conciergeHours = String(formData.get("concierge_hours") ?? "").trim();

  // Validazione per modalità (difesa lato server).
  if (accessMode === "concierge") {
    if (!accessNote) throw new Error("Nome del portinaio obbligatorio");
    if (!conciergeHours) throw new Error("Orario portineria obbligatorio");
  } else {
    if (!intercom) throw new Error("Citofono obbligatorio");
    if (!floor) throw new Error("Piano obbligatorio");
  }

  // Via + civico → riga indirizzo; CAP e città anche in colonne dedicate.
  const cap = String(formData.get("cap") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const street = [`${streetRaw} ${civico}`.trim(), cap, city].filter(Boolean).join(", ");

  // Zona derivata dal CAP (zone_caps). Se il CAP non è mappato → null (l'admin risolve).
  const zoneId = await zoneIdForCap(supabase, cap);

  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    label: String(formData.get("label") ?? "") || null,
    street,
    cap: cap || null,
    civico: civico || null,
    zone_id: zoneId,
    intercom: accessMode !== "concierge" ? intercom || null : null,
    floor: accessMode !== "concierge" ? floor || null : null,
    notes: String(formData.get("notes") ?? "") || null,
    access_mode: accessMode,
    access_note: accessNote || null,
    concierge_hours: accessMode === "concierge" ? conciergeHours || null : null,
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
