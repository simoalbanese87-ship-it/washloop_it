"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

/** Mette in addebito i capi speciali non ancora fatturati di un ordine.
 *
 *  Strategia "come i migliori": NON un prelievo immediato off-session (che su
 *  carte SCA verrebbe rifiutato con authentication_required), ma **invoice
 *  items** agganciati alla **prossima fattura dell'abbonamento**. Stripe li
 *  addebita in automatico a fine mese col mandato già accettato all'iscrizione
 *  — nessuna richiesta al cliente. Coerente con la dicitura in app
 *  ("addebito automatico a fine mese").
 *
 *  Solo admin. Importo = price_cli_cents (prezzo cliente, IVA inclusa). */
export async function chargeOrderSpecials(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Solo admin");

  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) throw new Error("Ordine mancante");

  const svc = createServiceClient();

  const { data: order } = await svc.from("orders").select("id, customer_id").eq("id", orderId).single();
  if (!order?.customer_id) throw new Error("Ordine o cliente non trovato");

  const { data: specials } = await svc
    .from("order_specials")
    .select("id, item_name, qty, price_cli_cents, charged_at")
    .eq("order_id", orderId)
    .is("charged_at", null);
  const pending = specials ?? [];
  if (pending.length === 0) throw new Error("Nessun capo da addebitare");

  // Customer + abbonamento Stripe del cliente.
  const { data: sub } = await svc
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status")
    .eq("user_id", order.customer_id)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const customerId = sub?.stripe_customer_id as string | undefined;
  if (!customerId) throw new Error("Cliente senza Customer Stripe (abbonamento mancante)");
  const subscriptionId = (sub?.stripe_subscription_id as string | null) ?? null;
  const subActive = !!sub?.status && ["active", "trialing"].includes(sub.status as string);

  const sk = stripe();

  // Un invoice item per capo (righe chiare in fattura). Se c'è un abbonamento
  // attivo lo aggancio a quella sottoscrizione → finisce sulla sua prossima
  // fattura; altrimenti resta in sospeso sul customer e verrà fatturato.
  const itemIds: { specialId: string; invoiceItemId: string }[] = [];
  for (const s of pending) {
    const ii = await sk.invoiceItems.create({
      customer: customerId,
      amount: s.price_cli_cents * s.qty,
      currency: "eur",
      description: `WashLoop · ${s.item_name}${s.qty > 1 ? ` ×${s.qty}` : ""} (ordine ${orderId.slice(0, 8)})`,
      ...(subscriptionId && subActive ? { subscription: subscriptionId } : {}),
      metadata: { order_id: orderId, special_id: s.id, kind: "order_specials" },
    });
    itemIds.push({ specialId: s.id, invoiceItemId: ii.id });
  }

  // Marca i capi come messi in fattura (charged_at = momento dell'accodamento).
  for (const it of itemIds) {
    await svc
      .from("order_specials")
      .update({ charged_at: new Date().toISOString(), stripe_invoice_item: it.invoiceItemId })
      .eq("id", it.specialId);
  }

  revalidatePath(`/admin/ordini/${orderId}`);
}
