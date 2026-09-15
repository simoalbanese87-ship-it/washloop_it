import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Il giorno a cui un compenso si riferisce.
 *
 *  Non è il giorno in cui scriviamo la riga. La riga dei sacchi nasce alla
 *  riconsegna, quella dei capi speciali quando la lavanderia li registra —
 *  qualche giorno prima — e una correzione può arrivare settimane dopo. Tre
 *  date diverse per lo stesso lavoro: raggruppando per quelle, un ritiro a
 *  cavallo di fine mese finisce spezzato fra due proforma.
 *
 *  Il servizio invece ha un giorno solo: **la riconsegna**, quando il lavoro è
 *  finito. In mancanza il ritiro, e in mancanza di tutto oggi — perché una riga
 *  di compenso senza periodo è peggio di una con un periodo approssimato: la
 *  prima non si può controllare affatto. */
export async function dataServizio(client: SupabaseClient, orderId: string | null): Promise<string> {
  const oggi = () => new Date().toISOString().slice(0, 10);
  if (!orderId) return oggi();

  const { data } = await client
    .from("orders")
    .select("created_at, riconsegna:slots!orders_delivery_slot_id_fkey(starts_at), ritiro:slots!orders_pickup_slot_id_fkey(starts_at)")
    .eq("id", orderId)
    .maybeSingle<{
      created_at: string;
      riconsegna: { starts_at: string } | { starts_at: string }[] | null;
      ritiro: { starts_at: string } | { starts_at: string }[] | null;
    }>();
  if (!data) return oggi();

  const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const quando = uno(data.riconsegna)?.starts_at ?? uno(data.ritiro)?.starts_at ?? data.created_at;
  return quando.slice(0, 10);
}
