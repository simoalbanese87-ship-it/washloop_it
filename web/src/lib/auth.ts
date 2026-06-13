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
