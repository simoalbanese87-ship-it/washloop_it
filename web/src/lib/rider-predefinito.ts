import type { SupabaseClient } from "@supabase/supabase-js";

/** Chi va a ritirare, quando nessuno l'ha ancora deciso.
 *
 *  Il cliente non c'entra
 *  ----------------------
 *  Da nessuna parte, e va detto perché è la prima cosa che sembra. In
 *  prenotazione non esiste un campo rider, la form non lo manda e questa
 *  funzione non legge niente che arrivi dal browser: parte dall'indirizzo, che
 *  il cliente sceglie perché è casa sua, e dalle zone, che le amministriamo
 *  noi. `courier_id` in arrivo da una form lo leggono due sole azioni, tutte e
 *  due admin (`assignOrder`, `assignCourier`).
 *
 *  Il difetto
 *  ----------
 *  Un ordine nasceva **sempre senza rider**. L'assegnazione esisteva solo come
 *  gesto: il bottone «assegna in automatico» nel board, o la scelta a mano
 *  sull'ordine. Finché nessuno lo faceva, il calendario mostrava «senza rider»
 *  in rosso su ogni riga, e per il rider quei giri non esistevano affatto. I
 *  ritiri settimanali li genera il cron ogni notte: nascevano tutti scoperti.
 *
 *  La regola
 *  ---------
 *  1. **Il rider della zona dell'indirizzo** (`zones.courier_id`). È la scelta
 *     già presa, scritta dove si amministra, e non è una cosa provvisoria: è la
 *     stessa priorità che usa da sempre il bottone «assegna in automatico».
 *
 *  2. **La clausola momentanea** — se tutte le zone attive hanno lo stesso
 *     rider, va a lui anche quando l'indirizzo non ha zona o la zona è
 *     scoperta. Vale finché di rider ne gira uno solo: con una persona sola non
 *     c'è niente da scegliere, e lasciare il campo vuoto è solo un modo di
 *     perdere il giro.
 *
 *     **Si spegne da sola**, e senza toccare il codice: basta che le zone
 *     attive abbiano rider diversi, o che una resti scoperta, e `scegliRider`
 *     torna `null` — cioè si torna a decidere a mano, che a quel punto è
 *     giusto, perché una scelta esiste davvero. Lo stato della clausola è
 *     scritto in chiaro in `/admin/sicurezza`: una cosa provvisoria che nessuno
 *     vede è una cosa provvisoria per sempre.
 *
 *  3. **Altrimenti niente**, e decide l'ops dal board.
 *
 *  Perché non «l'unico corriere registrato»
 *  ----------------------------------------
 *  Perché registrati ce ne sono due — uno serve le prove — e contarli darebbe
 *  la risposta sbagliata. Le zone attive dicono chi lavora davvero. È anche il
 *  motivo per cui il rider già scelto non si sovrascrive mai: è un ripiego, non
 *  una regola. */

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

export type ClausolaRider = {
  /** Se la regola 2 sta rispondendo, cioè se oggi copre gli indirizzi scoperti. */
  attiva: boolean;
  /** Chi riceverebbe quegli ordini. */
  riderId: string | null;
  /** Perché è così, in parole: è la riga che si legge in `/admin/sicurezza`. */
  motivo: string;
};

/** Lo stato della clausola momentanea, per mostrarlo invece di lasciarlo implicito. */
export async function statoClausolaRider(client: SupabaseClient): Promise<ClausolaRider> {
  const { data } = await client
    .from("zones")
    .select("name, courier_id, profiles:profiles!zones_courier_id_fkey(full_name)")
    .eq("active", true)
    .returns<{ name: string; courier_id: string | null; profiles: { full_name: string | null } | { full_name: string | null }[] | null }[]>();

  const zone = data ?? [];
  if (zone.length === 0) return { attiva: false, riderId: null, motivo: "Nessuna zona attiva: non c'è da dedurre niente." };

  const scoperte = zone.filter((z) => !z.courier_id).map((z) => z.name);
  if (scoperte.length > 0) {
    return {
      attiva: false,
      riderId: null,
      motivo: `Zone attive senza rider (${scoperte.join(", ")}): un ordine fuori zona nasce scoperto e lo assegna l'ops dal board.`,
    };
  }

  const unico = zone.every((z) => z.courier_id === zone[0].courier_id);
  const nome = (() => {
    const p = zone[0].profiles;
    return (Array.isArray(p) ? p[0] : p)?.full_name ?? "il rider della zona";
  })();

  return unico
    ? {
        attiva: true,
        riderId: zone[0].courier_id,
        motivo: `Attiva: ${zone.length === 1 ? "l'unica zona attiva è coperta" : "tutte le zone attive sono coperte"} da ${nome}, quindi anche gli ordini senza zona vanno a ${nome}. Si spegne da sola appena le zone attive avranno rider diversi.`,
      }
    : {
        attiva: false,
        riderId: null,
        motivo: "Le zone attive hanno rider diversi: la clausola si è spenta da sola, e ogni ordine prende il rider della sua zona.",
      };
}
