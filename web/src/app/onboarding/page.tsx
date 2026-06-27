import { redirect } from "next/navigation";
import { OnboardingWizard, type WizPlan } from "@/components/OnboardingWizard";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { roleHome } from "@/lib/orders";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  // Chi è già loggato salta l'onboarding e va alla home del proprio ruolo.
  // (Mai mandare al login: un admin/partner in sessione che apre /onboarding
  //  finirebbe sul login — era la causa del "non funziona su Firefox".)
  const profile = await getCurrentProfile();
  if (profile) redirect(roleHome(profile.role));

  const [{ plan }, supabase] = await Promise.all([searchParams, createClient()]);
  const { data: plans } = await supabase
    .from("plans")
    .select("id, code, name, price_month_cents, pickups_per_week, turnaround_hours")
    .eq("active", true)
    .order("sort")
    .returns<WizPlan[]>();

  return <OnboardingWizard plans={plans ?? []} initialPlanCode={plan ?? null} />;
}
