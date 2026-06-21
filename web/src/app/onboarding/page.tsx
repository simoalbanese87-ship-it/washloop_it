import { redirect } from "next/navigation";
import { OnboardingWizard, type WizPlan } from "@/components/OnboardingWizard";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  // Chi è già loggato salta l'onboarding.
  const profile = await getCurrentProfile();
  if (profile) redirect(profile.role === "customer" ? "/app" : "/login");

  const [{ plan }, supabase] = await Promise.all([searchParams, createClient()]);
  const { data: plans } = await supabase
    .from("plans")
    .select("id, code, name, price_month_cents, pickups_per_week, turnaround_hours")
    .eq("active", true)
    .order("sort")
    .returns<WizPlan[]>();

  return <OnboardingWizard plans={plans ?? []} initialPlanCode={plan ?? null} />;
}
