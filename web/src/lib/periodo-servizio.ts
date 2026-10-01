import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { giornoDiCompetenza } from "@/lib/competenza-giorno";

/** Il giorno a cui un compenso della lavanderia si riferisce.
 *
 *  La regola sta in `competenza-giorno.ts`, che è collaudata: qui c'è solo la
 *  lettura delle tre date dall'ordine. In breve: vale **la presa in carico**,
 *  cioè il ritiro — il giorno in cui la roba entra in lavanderia è il giorno in
 *  cui nasce il costo. */
export async function dataServizio(client: SupabaseClient, orderId: string | null): Promise<string> {
  const oggi = new Date().toISOString().slice(0, 10);
  if (!orderId) return oggi;

  const { data } = await client
    .from("orders")
    .select("created_at, riconsegna:slots!orders_delivery_slot_id_fkey(starts_at), ritiro:slots!orders_pickup_slot_id_fkey(starts_at)")
    .eq("id", orderId)
    .maybeSingle<{
      created_at: string;
      riconsegna: { starts_at: string } | { starts_at: string }[] | null;
      ritiro: { starts_at: string } | { starts_at: string }[] | null;
    }>();
  if (!data) return oggi;

  const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  return giornoDiCompetenza(
    uno(data.ritiro)?.starts_at ?? null,
    uno(data.riconsegna)?.starts_at ?? null,
    data.created_at,
    oggi,
  );
}
