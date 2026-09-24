import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scegliTetto } from "@/lib/tetto-sacchi";

/** Quanti sacchi a settimana comprende l'abbonamento di un cliente.
 *
 *  È il tetto con cui si conta e si paga. Questa funzione va a prendere le tre
 *  fonti; a scegliere fra loro è `scegliTetto`, che è puro e ha i test — lì c'è
 *  scritto perché l'ordine è quello e perché lo zero viene scartato.
 *
 *  `null` quando non lo sappiamo, e allora **non si inventa**: chi chiama conta
 *  quello che ha osservato e lo dichiara. Un tetto immaginato sarebbe peggio di
 *  nessun tetto, perché nessuno saprebbe da dove viene. */
export async function sacchiInclusi(client: SupabaseClient, customerId: string): Promise<number | null> {
  const [{ data: sub }, { data: rec }] = await Promise.all([
    client
      .from("subscriptions")
      .select("bags_per_week, plans(bags_per_week)")
      .eq("user_id", customerId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        bags_per_week: number | null;
        plans: { bags_per_week: number | null } | { bags_per_week: number | null }[] | null;
      }>(),
    client
      .from("recurring_pickups")
      .select("bags")
      .eq("customer_id", customerId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ bags: number | null }>(),
  ]);

  // PostgREST tipizza l'innesto uno-a-uno come oggetto ma a volte lo dà come
  // array: leggerlo in un modo solo lascerebbe il tetto a null senza dirlo.
  const p = sub?.plans;
  const daPiano = (Array.isArray(p) ? p[0] : p)?.bags_per_week;

  return scegliTetto(sub?.bags_per_week, daPiano, rec?.bags);
}
