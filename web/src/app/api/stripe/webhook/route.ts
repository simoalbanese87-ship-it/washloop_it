import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

/** Webhook Stripe → aggiorna `subscriptions` con service-role (bypassa RLS).
 *  Eventi gestiti: checkout completato, subscription creata/aggiornata/cancellata. */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "config" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `signature: ${(err as Error).message}` }, { status: 400 });
  }

  const db = createServiceClient();

  async function upsertFromSubscription(sub: Stripe.Subscription) {
    const userId = sub.metadata?.supabase_user_id;
    const planId = sub.metadata?.plan_id ?? null;
    // Stripe: current_period_end è top-level nelle vecchie API, sugli items nelle nuove.
    const periodEnd =
      (sub as unknown as { current_period_end?: number }).current_period_end ??
      (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
    await db.from("subscriptions").upsert(
      {
        user_id: userId,
        plan_id: planId,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        status: sub.status,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      },
      { onConflict: "stripe_subscription_id" },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await stripe().subscriptions.retrieve(session.subscription as string);
        if (!sub.metadata?.supabase_user_id && session.metadata?.supabase_user_id) {
          sub.metadata = { ...sub.metadata, ...session.metadata };
        }
        await upsertFromSubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await upsertFromSubscription(event.data.object as Stripe.Subscription);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
