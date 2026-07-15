import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

/** Logica condivisa di addebito capi speciali (usata da admin "Metti in fattura"
 *  e dall'inserimento automatico lavanderia). Strategia: invoice item agganciato
 *  alla prossima fattura dell'abbonamento (mandato già accettato), non prelievo
 *  immediato. Sempre chiamata con service role. */

type StripeCustomer = { customerId: string; subscriptionId: string | null; subActive: boolean };

async function stripeCustomerFor(svc: SupabaseClient, userId: string): Promise<StripeCustomer | null> {
  const { data: sub } = await svc
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status")
    .eq("user_id", userId)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string | null; stripe_subscription_id: string | null; status: string | null }>();
  const customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) return null;
  return {
    customerId,
    subscriptionId: sub?.stripe_subscription_id ?? null,
    subActive: !!sub?.status && ["active", "trialing"].includes(sub.status),
  };
}

export type ChargeResult =
  | { ok: true; itemName: string; priceCents: number; customerId: string }
  | { ok: false; reason: "not_found" | "already_charged" | "no_customer" | "no_stripe_customer" };

/** Addebita UN capo speciale (se non già addebitato) come invoice item sulla
 *  prossima fattura. Marca charged_at + stripe_invoice_item. Non lancia per motivi
 *  di business (ritorna ok:false); può lanciare solo su errore Stripe imprevisto,
 *  da gestire best-effort dal chiamante. */
export async function chargeSpecialById(svc: SupabaseClient, specialId: string): Promise<ChargeResult> {
  const { data: sp } = await svc
    .from("order_specials")
    .select("id, order_id, item_name, qty, price_cli_cents, charged_at, refunded_at, orders(customer_id)")
    .eq("id", specialId)
    .maybeSingle<{ id: string; order_id: string; item_name: string; qty: number; price_cli_cents: number; charged_at: string | null; refunded_at: string | null; orders: { customer_id: string | null } | null }>();
  if (!sp) return { ok: false, reason: "not_found" };
  if (sp.charged_at || sp.refunded_at) return { ok: false, reason: "already_charged" };
  const userId = sp.orders?.customer_id ?? null;
  if (!userId) return { ok: false, reason: "no_customer" };

  const cust = await stripeCustomerFor(svc, userId);
  if (!cust) return { ok: false, reason: "no_stripe_customer" };

  const amount = sp.price_cli_cents * sp.qty;
  const ii = await stripe().invoiceItems.create({
    customer: cust.customerId,
    amount,
    currency: "eur",
    description: `WashLoop · ${sp.item_name}${sp.qty > 1 ? ` ×${sp.qty}` : ""} (ordine ${sp.order_id.slice(0, 8)})`,
    ...(cust.subscriptionId && cust.subActive ? { subscription: cust.subscriptionId } : {}),
    metadata: { order_id: sp.order_id, special_id: sp.id, kind: "order_specials" },
  });

  await svc
    .from("order_specials")
    .update({ charged_at: new Date().toISOString(), stripe_invoice_item: ii.id })
    .eq("id", sp.id);

  return { ok: true, itemName: sp.item_name, priceCents: amount, customerId: userId };
}
