import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Mappa un CAP alla zona (quadrante) via `zone_caps`. Ritorna null se il CAP non
 *  è mappato o se la zona è disattivata — in tal caso l'indirizzo resta senza zona
 *  e l'admin la assegna a mano.
 *  Aggiungere zone o riassegnare CAP = solo dati in `zones`/`zone_caps`, nessun deploy.
 *
 *  Il filtro su `zones.active` è la ragione per cui questa funzione fa una join e
 *  non una lettura secca: la landing decide da qui se dire "ti copriamo". Senza il
 *  filtro, disattivare una zona dal pannello non cambiava niente per chi arrivava
 *  dalla pubblicità — continuavamo a promettere il servizio dove non c'è nessun
 *  rider. I CAP restano mappati anche a zona spenta, così riaccenderla è un
 *  interruttore e non una migration. */
export async function zoneIdForCap(supabase: SupabaseClient, cap: string | null | undefined): Promise<string | null> {
  const c = (cap ?? "").trim();
  if (!/^\d{5}$/.test(c)) return null;
  const { data } = await supabase
    .from("zone_caps")
    .select("zone_id, zones!inner(active)")
    .eq("cap", c)
    .eq("zones.active", true)
    .maybeSingle<{ zone_id: string }>();
  return data?.zone_id ?? null;
}
