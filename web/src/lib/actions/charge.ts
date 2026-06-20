"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

/** Addebita al cliente i capi speciali non ancora addebitati di un ordine.
 *  Off-session: usa il metodo di pagamento salvato con l'abbonamento.
 *  Solo admin. Importo = somma price_cli_cents (prezzo cliente), non il compenso. */
export async function chargeOrderSpecials(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Solo admin");

  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) throw new Error("Ordine mancante");

  const svc = createServiceClient();

  // Ordine + cliente.
  const { data: order } = await svc.from("orders").select("id, customer_id").eq("id", orderId).single();
  if (!order?.customer_id) throw new Error("Ordine o cliente non trovato");

  // Capi non ancora addebitati.
  const { data: specials } = await svc
    .from("order_specials")
    .select("id, item_name, qty, price_cli_cents, charged_at")
    .eq("order_id", orderId)
    .is("charged_at", null);
  const pending = specials ?? [];
  if (pending.length === 0) throw new Error("Nessun capo da addebitare");

  const amount = pending.reduce((s, r) => s + r.price_cli_cents * r.qty, 0);
  if (amount <= 0) throw new Error("Importo non valido");

  // Customer Stripe dall'abbonamento.
  const { data: sub } = await svc
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", order.customer_id)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();
  const customerId = sub?.stripe_customer_id as string | undefined;
  if (!customerId) throw new Error("Cliente senza Customer Stripe (abbonamento mancante)");

  const sk = stripe();

  // Metodo di pagamento: default fatture, altrimenti la prima carta salvata.
  const customer = (await sk.customers.retrieve(customerId)) as Stripe.Customer;
  let pm = (customer.invoice_settings?.default_payment_method as string | null) ?? null;
  if (!pm) {
    const list = await sk.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    pm = list.data[0]?.id ?? null;
  }
  if (!pm) throw new Error("Nessun metodo di pagamento salvato per il cliente");

  // Addebito off-session.
  let pi: Stripe.PaymentIntent;
  try {
    pi = await sk.paymentIntents.create({
      amount,
      currency: "eur",
      customer: customerId,
      payment_method: pm,
      off_session: true,
      confirm: true,
      description: `WashLoop capi speciali · ordine ${orderId.slice(0, 8)}`,
      metadata: { order_id: orderId, kind: "order_specials" },
    });
  } catch (err) {
    // Tipico: authentication_required (SCA) → serve azione del cliente.
    const msg = err instanceof Error ? err.message : "errore sconosciuto";
    throw new Error(`Addebito non riuscito: ${msg}`);
  }

  if (pi.status !== "succeeded") {
    throw new Error(`Addebito in stato "${pi.status}": riprova o contatta il cliente`);
  }

  // Marca i capi come addebitati.
  const ids = pending.map((r) => r.id);
  const { error } = await svc
    .from("order_specials")
    .update({ charged_at: new Date().toISOString(), stripe_invoice_item: pi.id })
    .in("id", ids);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/ordini/${orderId}`);
}
