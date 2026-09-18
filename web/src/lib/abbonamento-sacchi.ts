import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Quanti sacchi a settimana comprende l'abbonamento di un cliente.
 *
 *  È il tetto con cui si conta e si paga. Due fonti, in quest'ordine:
 *
 *  1. **Il piano collegato all'abbonamento** (`plans.bags_per_week`). È il
 *     dato giusto: è quello che il cliente ha comprato.
 *  2. **Il ritiro settimanale** (`recurring_pickups.bags`). Ripiego, ma non un
 *     ripiego qualunque: oggi quattro clienti su cinque hanno un abbonamento a
 *     prezzo personalizzato senza piano collegato, e senza questa seconda fonte
 *     per loro il tetto non esisterebbe affatto.
 *
 *  `null` quando non lo sappiamo, e allora **non si inventa**: chi chiama conta
 *  quello che ha osservato e lo dichiara. Un tetto immaginato sarebbe peggio di
 *  nessun tetto, perché nessuno saprebbe da dove viene.
 *
 *  Da sistemare a monte: collegare un piano alle tre iscrizioni personalizzate
 *  farebbe sparire il ripiego. Finché non succede, questa funzione è l'unica
 *  cosa che tiene in piedi il conto per quei clienti. */
export async function sacchiInclusi(client: SupabaseClient, customerId: string): Promise<number | null> {
  const [{ data: sub }, { data: rec }] = await Promise.all([
    client
      .from("subscriptions")
      .select("plans(bags_per_week)")
      .eq("user_id", customerId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ plans: { bags_per_week: number | null } | { bags_per_week: number | null }[] | null }>(),
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
  if (typeof daPiano === "number" && daPiano > 0) return daPiano;

  return typeof rec?.bags === "number" && rec.bags > 0 ? rec.bags : null;
}
