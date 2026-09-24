import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Conta gli ordini NON annullati agganciati a una lista di slot, per colonna
 *  (ritiro o consegna). Una sola query; il tally è in JS. */
async function counts(
  client: SupabaseClient,
  col: "pickup_slot_id" | "delivery_slot_id",
  ids: string[],
): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (ids.length === 0) return m;
  const { data } = await client.from("orders").select(col).in(col, ids).neq("status", "cancelled");
  for (const r of (data ?? []) as Record<string, string | null>[]) {
    const k = r[col];
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export const pickupCounts = (client: SupabaseClient, ids: string[]) => counts(client, "pickup_slot_id", ids);
export const deliveryCounts = (client: SupabaseClient, ids: string[]) => counts(client, "delivery_slot_id", ids);

/** Messaggio amichevole per gli errori di capacità sollevati dal trigger DB. */
export function slotFullMessage(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (msg.includes("SLOT_PICKUP_FULL")) return "Questa fascia di ritiro è al completo. Scegline un'altra, per favore.";
  if (msg.includes("SLOT_DELIVERY_FULL")) return "Questa fascia di consegna è al completo. Scegline un'altra, per favore.";
  return null;
}
