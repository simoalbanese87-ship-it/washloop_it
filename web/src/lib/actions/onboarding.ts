"use server";

import { createClient } from "@/lib/supabase/server";

/** Crea l'indirizzo principale durante l'onboarding (utente già registrato).
 *  Zona = prima zona attiva (serviamo tutta Milano). Ritorna ok/errore. */
export async function createOnboardingAddress(input: {
  street: string;
  civico?: string | null;
  cap?: string | null;
  city?: string | null;
  intercom?: string | null;
  floor?: string | null;
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
  const civico = (input.civico ?? "").trim();
  if (!street) return { ok: false, error: "Via obbligatoria" };
  if (!civico) return { ok: false, error: "Numero civico obbligatorio" };

  const mode = input.access_mode || "door";
  // Validazione per modalità (difesa lato server, oltre a quella nel wizard).
  if (mode === "concierge") {
    if (!(input.access_note ?? "").trim()) return { ok: false, error: "Nome del portinaio obbligatorio" };
    if (!(input.concierge_hours ?? "").trim()) return { ok: false, error: "Orario portineria obbligatorio" };
  } else {
    if (!(input.intercom ?? "").trim()) return { ok: false, error: "Citofono obbligatorio" };
    if (!(input.floor ?? "").trim()) return { ok: false, error: "Piano obbligatorio" };
  }

  const { data: zone } = await supabase.from("zones").select("id").eq("active", true).order("name").limit(1).maybeSingle<{ id: string }>();

  // Via + civico → riga indirizzo; CAP e città concatenati (nessuna colonna dedicata).
  const streetLine = `${street} ${civico}`.trim();
  const fullStreet = [streetLine, input.cap?.trim(), (input.city?.trim() || "Milano")].filter(Boolean).join(", ");

  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    label: "Casa",
    street: fullStreet,
    zone_id: zone?.id ?? null,
    intercom: mode !== "concierge" ? (input.intercom ?? "").trim() || null : null,
    floor: mode !== "concierge" ? (input.floor ?? "").trim() || null : null,
    access_mode: mode,
    access_note: (input.access_note ?? "").trim() || null,
    concierge_hours: mode === "concierge" ? (input.concierge_hours ?? "").trim() || null : null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
