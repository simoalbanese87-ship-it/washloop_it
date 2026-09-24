import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkoutUrlForPlan } from "@/lib/checkout";

/**
 * Ponte Attiva → iscrizione → pagamento.
 * Arriva qui l'utente appena registrato/loggato con ?plan=<code>.
 * Risolve il piano e reindirizza dritto a Stripe Checkout.
 */
export default async function CheckoutBridgePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: code } = await searchParams;
  if (!code) redirect("/app/abbonamento");

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();
  if (!plan) redirect("/app/abbonamento");

  redirect(await checkoutUrlForPlan(plan.id));
}
