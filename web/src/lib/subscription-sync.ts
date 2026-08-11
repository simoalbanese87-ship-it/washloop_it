import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

/** Scrive su `subscriptions` lo stato reale di un abbonamento Stripe.
 *
 *  Sta qui e non dentro il webhook perché serve a DUE percorsi:
 *  1. il webhook, quando Stripe ci chiama;
 *  2. la pagina di ritorno del checkout, quando il webhook non è ancora
 *     arrivato o è fallito.
 *
 *  Prima esisteva solo il primo. Se il webhook si perdeva, il cliente aveva
 *  pagato, la pagina gli diceva "abbonamento attivo" e poi l'app lo rimandava a
 *  comprare un piano. È idempotente: rieseguirla non produce effetti diversi. */
export async function syncSubscription(sub: Stripe.Subscription): Promise<{ ok: boolean; error?: string }> {
  const db = createServiceClient();

  const userId = sub.metadata?.supabase_user_id;
  if (!userId) return { ok: false, error: "subscription senza supabase_user_id nei metadata" };

  const planId = sub.metadata?.plan_id ?? null;
  // Stripe: current_period_end è top-level nelle vecchie API, sugli items nelle nuove.
  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;

  const row: Record<string, unknown> = {
    user_id: userId,
    plan_id: planId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  };
  const customCents = sub.metadata?.custom_price_cents ? parseInt(sub.metadata.custom_price_cents, 10) : NaN;
  if (Number.isFinite(customCents)) row.custom_price_cents = customCents;

  // L'errore va guardato: prima veniva ignorato e la route rispondeva comunque
  // 200, quindi Stripe considerava l'evento consegnato e il dato spariva.
  const { error } = await db.from("subscriptions").upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) return { ok: false, error: error.message };

  if (["active", "trialing"].includes(sub.status)) {
    await db.from("subscriptions")
      .update({ activated_at: new Date().toISOString(), canceled_at: null })
      .eq("stripe_subscription_id", sub.id)
      .is("activated_at", null);
    await db.from("subscriptions").update({ canceled_at: null }).eq("stripe_subscription_id", sub.id);
  } else if (sub.status === "canceled") {
    await db.from("subscriptions")
      .update({ canceled_at: new Date().toISOString() })
      .eq("stripe_subscription_id", sub.id)
      .is("canceled_at", null);
  }

  return { ok: true };
}

/** Rete di sicurezza del ritorno da Checkout: se il webhook non è ancora
 *  passato, allinea l'abbonamento leggendo la sessione direttamente da Stripe.
 *  Non lancia mai: la pagina di ringraziamento deve aprirsi comunque. */
export async function syncFromCheckoutSession(sessionId: string): Promise<{ attivo: boolean }> {
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" && session.status !== "complete") return { attivo: false };
    if (!session.subscription) return { attivo: false };

    const sub = await stripe().subscriptions.retrieve(session.subscription as string);
    // I metadata stanno sulla sessione quando la subscription è appena nata.
    if (!sub.metadata?.supabase_user_id && session.metadata?.supabase_user_id) {
      sub.metadata = { ...sub.metadata, ...session.metadata };
    }
    const res = await syncSubscription(sub);
    if (!res.ok) console.error("[checkout] sync fallita:", res.error);
    return { attivo: ["active", "trialing"].includes(sub.status) };
  } catch (err) {
    console.error("[checkout] impossibile verificare la sessione:", err);
    return { attivo: false };
  }
}

/** Evento già processato? Stripe ritenta per 3 giorni: senza questo controllo la
 *  ricevuta di addebito partiva a ogni tentativo. */
export async function eventoGiaVisto(eventId: string, type: string): Promise<boolean> {
  const db = createServiceClient();
  const { error } = await db.from("stripe_events").insert({ id: eventId, type });
  // 23505 = chiave duplicata → l'abbiamo già gestito.
  if (error && (error as { code?: string }).code === "23505") return true;
  return false;
}
