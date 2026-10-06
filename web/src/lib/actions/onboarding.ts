"use server";

import { createClient } from "@/lib/supabase/server";
import { zoneIdForCap } from "@/lib/zones";
import { geocodeAddress } from "@/lib/geo";
import { cookies } from "next/headers";
import { registraInvito } from "@/lib/referral";

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

  // Zona derivata dal CAP (zone_caps). Se non mappato → null (l'admin risolve).
  const cap = (input.cap ?? "").trim();
  const city = input.city?.trim() || "Milano";
  const zoneId = await zoneIdForCap(supabase, cap);
  // Coordinate (best-effort) per la mappa del rider.
  const geo = await geocodeAddress({ street, civico, cap, city });

  // Via + civico → riga indirizzo; CAP e città anche in colonne dedicate.
  const streetLine = `${street} ${civico}`.trim();
  const fullStreet = [streetLine, cap, city].filter(Boolean).join(", ");

  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    label: "Casa",
    street: fullStreet,
    cap: cap || null,
    civico: civico || null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    zone_id: zoneId,
    intercom: mode !== "concierge" ? (input.intercom ?? "").trim() || null : null,
    floor: mode !== "concierge" ? (input.floor ?? "").trim() || null : null,
    access_mode: mode,
    access_note: (input.access_note ?? "").trim() || null,
    concierge_hours: mode === "concierge" ? (input.concierge_hours ?? "").trim() || null : null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Porta un amico: lega il nuovo iscritto a chi l'ha invitato.
 *
 *  Si chiama subito dopo la registrazione, dal wizard. Il codice arriva dal
 *  link (`?ref=`) oppure dal cookie messo da `proxy.ts` quando la persona ha
 *  aperto l'invito: le due strade esistono perché chi apre un link di invito
 *  quasi mai si iscrive nello stesso minuto.
 *
 *  Non lancia e non blocca niente: un invito perso è un peccato, un'iscrizione
 *  che fallisce per colpa di un invito è molto peggio. */
export async function collegaInvito(codiceDalLink?: string | null): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const biscotti = await cookies();
  const codice = codiceDalLink?.trim() || biscotti.get("wl_invito")?.value || null;
  if (!codice) return;

  await registraInvito(user.id, codice);
}
