"use server";

import { createClient } from "@/lib/supabase/server";

/** Crea l'indirizzo principale durante l'onboarding (utente già registrato).
 *  Zona = prima zona attiva (serviamo tutta Milano). Ritorna ok/errore. */
export async function createOnboardingAddress(input: {
  street: string;
  cap?: string | null;
  city?: string | null;
  access_mode?: string | null;
  access_note?: string | null;
  concierge_hours?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessione non trovata. Riprova ad accedere." };

  const street = input.street.trim();
  if (!street) return { ok: false, error: "Indirizzo obbligatorio" };

  const { data: zone } = await supabase.from("zones").select("id").eq("active", true).order("name").limit(1).maybeSingle<{ id: string }>();

  const fullStreet = [street, input.cap?.trim(), (input.city?.trim() || "Milano")].filter(Boolean).join(", ");

  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    label: "Casa",
    street: fullStreet,
    zone_id: zone?.id ?? null,
    access_mode: input.access_mode || "door",
    access_note: input.access_note || null,
    concierge_hours: input.concierge_hours || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
