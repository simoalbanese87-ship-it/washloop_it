import type { SupabaseClient } from "@supabase/supabase-js";

/** Chi va a ritirare, quando nessuno l'ha ancora deciso.
 *
 *  Il difetto
 *  ----------
 *  Un ordine nasceva **sempre senza rider**. L'assegnazione esisteva solo come
 *  gesto: il bottone «assegna in automatico» nel board, o la scelta a mano
 *  sull'ordine. Finché nessuno lo faceva, il calendario mostrava «senza rider»
 *  in rosso su ogni riga — otto passaggi su otto — e per il rider quei giri non
 *  esistevano affatto.
 *
 *  Non era un caso limite: i ritiri li genera il cron ogni notte, e nascevano
 *  tutti scoperti. Qualcuno doveva accorgersene e premere.
 *
 *  La regola
 *  ---------
 *  1. **Il rider della zona dell'indirizzo** (`zones.courier_id`). È la scelta
 *     già presa, scritta dove si amministra.
 *  2. **Altrimenti, se tutte le zone attive hanno lo stesso rider, quello.**
 *     Copre gli indirizzi senza zona e le zone senza rider: se in giro c'è una
 *     persona sola non c'è niente da scegliere, e lasciare il campo vuoto è
 *     solo un modo di perdere il giro.
 *  3. **Altrimenti niente**, e decide l'ops. Il giorno in cui le zone attive
 *     avranno rider diversi, il punto 2 smette di rispondere da solo: a quel
 *     punto una scelta esiste davvero, e non deve farla il codice.
 *
 *  Perché non «l'unico corriere registrato»
 *  ----------------------------------------
 *  Perché registrati ce ne sono due — uno serve le prove — e contarli darebbe
 *  la risposta sbagliata. Le zone attive dicono chi lavora davvero, che è la
 *  domanda vera. È anche il motivo per cui questa funzione non sovrascrive mai
 *  un rider già scelto: è un ripiego, non una regola. */

/** La scelta, senza database intorno: così si può provare. */
export function scegliRider(riderDellaZona: string | null, riderDelleZoneAttive: (string | null)[]): string | null {
  if (riderDellaZona) return riderDellaZona;
  const coperte = riderDelleZoneAttive.filter((r): r is string => !!r);
  // Tutte le zone attive coperte, e da una persona sola.
  if (coperte.length === 0 || coperte.length !== riderDelleZoneAttive.length) return null;
  return coperte.every((r) => r === coperte[0]) ? coperte[0] : null;
}

/** Il rider da mettere su un ordine appena creato a quell'indirizzo. */
export async function riderPerIndirizzo(client: SupabaseClient, addressId: string | null): Promise<string | null> {
  const [indirizzo, zone] = await Promise.all([
    addressId
      ? client.from("addresses").select("zones(courier_id)").eq("id", addressId).maybeSingle<{ zones: { courier_id: string | null } | { courier_id: string | null }[] | null }>()
      : Promise.resolve({ data: null }),
    client.from("zones").select("courier_id").eq("active", true).returns<{ courier_id: string | null }[]>(),
  ]);

  // PostgREST tipizza l'innesto uno-a-uno come oggetto ma a volte lo restituisce
  // come array: leggerlo in un modo solo lascerebbe il rider a null senza dirlo.
  const z = indirizzo.data?.zones;
  const riderZona = (Array.isArray(z) ? z[0] : z)?.courier_id ?? null;

  return scegliRider(riderZona, (zone.data ?? []).map((r) => r.courier_id));
}
