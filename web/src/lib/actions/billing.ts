"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe, siteUrl } from "@/lib/stripe";
import { checkoutUrlForPlan } from "@/lib/checkout";

/** Avvia il Checkout Stripe per un piano (form abbonamento). */
export async function startCheckout(formData: FormData) {
  const planId = String(formData.get("plan_id") ?? "");
  if (!planId) throw new Error("Piano mancante");
  redirect(await checkoutUrlForPlan(planId));
}

/** Apre il Customer Portal Stripe per gestire/cancellare l'abbonamento. */
export async function openPortal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!data?.stripe_customer_id) redirect("/app/abbonamento");

  const session = await stripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id as string,
    return_url: `${siteUrl()}/app/abbonamento`,
  });
  redirect(session.url);
}
