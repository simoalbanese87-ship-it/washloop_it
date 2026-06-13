"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe, siteUrl } from "@/lib/stripe";

/** Avvia il Checkout Stripe per un piano. Crea/recupera il customer e reindirizza. */
export async function startCheckout(formData: FormData) {
  const planId = String(formData.get("plan_id") ?? "");
  if (!planId) throw new Error("Piano mancante");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/abbonamento");

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, stripe_price_id")
    .eq("id", planId)
    .single();
  if (!plan?.stripe_price_id) throw new Error("Prezzo Stripe non configurato per questo piano");

  // Recupera eventuale customer esistente
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user!.id)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user!.email ?? undefined,
      metadata: { supabase_user_id: user!.id },
    });
    customerId = customer.id;
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${siteUrl()}/app?checkout=success`,
    cancel_url: `${siteUrl()}/app/abbonamento?checkout=cancel`,
    metadata: { supabase_user_id: user!.id, plan_id: plan.id },
    subscription_data: { metadata: { supabase_user_id: user!.id, plan_id: plan.id } },
  });

  if (session.url) redirect(session.url);
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
