import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Mappa un CAP alla zona (quadrante) via `zone_caps`. Ritorna null se il CAP non
 *  è mappato — in tal caso l'indirizzo resta senza zona e l'admin la assegna a mano.
 *  Aggiungere zone o riassegnare CAP = solo dati in `zones`/`zone_caps`, nessun deploy. */
export async function zoneIdForCap(supabase: SupabaseClient, cap: string | null | undefined): Promise<string | null> {
  const c = (cap ?? "").trim();
  if (!/^\d{5}$/.test(c)) return null;
  const { data } = await supabase.from("zone_caps").select("zone_id").eq("cap", c).maybeSingle<{ zone_id: string }>();
  return data?.zone_id ?? null;
}
