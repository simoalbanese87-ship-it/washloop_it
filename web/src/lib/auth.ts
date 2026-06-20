import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/orders";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  laundry_id: string | null;
};

/** Ritorna utente + profilo correnti, o null se non loggato. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, laundry_id")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

/** Stati Stripe che abilitano la prenotazione. */
const ACTIVE_SUB_STATUSES = ["active", "trialing"];

/** True se l'utente corrente ha un abbonamento attivo (o in prova). */
export async function hasActiveSubscription(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string }>();
  return !!data && ACTIVE_SUB_STATUSES.includes(data.status);
}
