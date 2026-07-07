import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe, siteUrl } from "@/lib/stripe";

/**
 * Crea/recupera il customer Stripe per l'utente loggato e apre una sessione
 * di Checkout per il piano indicato. Ritorna l'URL di Stripe.
 * Riusata sia dal form abbonamento sia dal flusso Attiva → iscrizione → pay.
 */
export async function checkoutUrlForPlan(planId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?mode=signup");

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
    .eq("user_id", user.id)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    // Metodi consentiti: carta (+ Apple/Google Pay), Link, Amazon Pay. Klarna escluso.
    payment_method_types: ["card", "link", "amazon_pay"],
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    // Pagina di conferma dedicata (conversione Google Ads). {CHECKOUT_SESSION_ID}
    // è sostituito da Stripe → serve per deduplicare la conversione.
    success_url: `${siteUrl()}/checkout/grazie?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/app/abbonamento?checkout=cancel`,
    metadata: { supabase_user_id: user.id, plan_id: plan.id },
    subscription_data: { metadata: { supabase_user_id: user.id, plan_id: plan.id } },
  });

  if (!session.url) throw new Error("Stripe non ha restituito un URL di checkout");
  return session.url;
}
