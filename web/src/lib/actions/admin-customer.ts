"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

async function requireAdmin() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  return me;
}

const eurToCents = (v: string) => Math.round(parseFloat(String(v).replace(",", ".")) * 100);

/** Crea un cliente reale con abbonamento "manuale" a prezzo concordato (anche
 *  sotto lo Small). Nessun addebito Stripe: fatturazione gestita offline. */
export async function createCustomer(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const plan_id = String(formData.get("plan_id") ?? "") || null;
  const priceRaw = String(formData.get("price_eur") ?? "").trim();
  if (!email || !full_name) throw new Error("Email e nome obbligatori");

  const svc = createServiceClient();
  const password = `WL!${crypto.randomBytes(4).toString("hex")}`;
  const { data: created, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name, phone },
  });
  if (error || !created?.user) throw new Error(error?.message || "Creazione cliente fallita");
  const uid = created.user.id;
  await svc.from("profiles").update({ full_name, phone }).eq("id", uid);

  const custom = priceRaw ? eurToCents(priceRaw) : null;
  await svc.from("subscriptions").insert({
    user_id: uid,
    plan_id,
    status: "active",
    manual: true,
    custom_price_cents: Number.isFinite(custom as number) ? custom : null,
    current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });

  revalidatePath("/admin/abbonati");
  redirect(`/admin/abbonati/${uid}`);
}

/** Pausa / riprendi / disdici l'abbonamento (Stripe se collegato, altrimenti DB). */
export async function changeSubscription(formData: FormData) {
  await requireAdmin();
  const subId = String(formData.get("sub_id") ?? "");
  const action = String(formData.get("action") ?? ""); // pause | resume | cancel
  if (!subId || !action) throw new Error("Parametri mancanti");

  const svc = createServiceClient();
  const { data: sub } = await svc
    .from("subscriptions")
    .select("id, user_id, stripe_subscription_id, manual")
    .eq("id", subId)
    .maybeSingle<{ id: string; user_id: string; stripe_subscription_id: string | null; manual: boolean }>();
  if (!sub) throw new Error("Abbonamento non trovato");

  const stripeId = sub.stripe_subscription_id;
  if (stripeId) {
    const sk = stripe();
    if (action === "pause") await sk.subscriptions.update(stripeId, { pause_collection: { behavior: "void" } });
    else if (action === "resume") await sk.subscriptions.update(stripeId, { pause_collection: null });
    else if (action === "cancel") await sk.subscriptions.update(stripeId, { cancel_at_period_end: true });
    // lo stato reale arriva dal webhook; aggiorno comunque un valore ottimistico
  }
  const status = action === "pause" ? "paused" : action === "cancel" ? "canceled" : "active";
  await svc.from("subscriptions").update({ status }).eq("id", subId);

  revalidatePath(`/admin/abbonati/${sub.user_id}`);
}

/** Aggiunge un addebito o un rimborso ad-hoc al cliente (extra personalizzato,
 *  modifica, credito). Se il cliente ha un Customer Stripe e kind='charge',
 *  lo aggancia come invoice item alla prossima fattura. I rimborsi vengono
 *  registrati nel ledger: il rimborso monetario va confermato da Stripe. */
export async function addCustomerCharge(formData: FormData) {
  const me = await requireAdmin();
  const customerId = String(formData.get("customer_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const kind = String(formData.get("kind") ?? "charge"); // charge | refund
  const amount = eurToCents(String(formData.get("amount_eur") ?? ""));
  if (!customerId || !description || !Number.isFinite(amount) || amount <= 0) throw new Error("Dati addebito non validi");

  const svc = createServiceClient();
  let status = "pending";
  let stripeRef: string | null = null;

  if (kind === "charge") {
    const { data: sub } = await svc
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", customerId)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ stripe_customer_id: string | null; stripe_subscription_id: string | null; status: string }>();
    if (sub?.stripe_customer_id) {
      const active = ["active", "trialing"].includes(sub.status);
      const ii = await stripe().invoiceItems.create({
        customer: sub.stripe_customer_id,
        amount,
        currency: "eur",
        description: `WashLoop · ${description}`,
        ...(sub.stripe_subscription_id && active ? { subscription: sub.stripe_subscription_id } : {}),
        metadata: { kind: "admin_custom", customer_id: customerId },
      });
      status = "invoiced";
      stripeRef = ii.id;
    }
  }

  await svc.from("customer_charges").insert({
    customer_id: customerId,
    description,
    amount_cents: amount,
    kind,
    status,
    stripe_ref: stripeRef,
    created_by: me.id,
  });

  revalidatePath(`/admin/abbonati/${customerId}`);
}

/** Modifica importo/descrizione di un addebito (e l'invoice item Stripe se non
 *  ancora fatturato). */
export async function editCustomerCharge(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = eurToCents(String(formData.get("amount_eur") ?? ""));
  if (!id || !description || !Number.isFinite(amount) || amount <= 0) throw new Error("Dati non validi");

  const svc = createServiceClient();
  const { data: row } = await svc.from("customer_charges").select("stripe_ref, status").eq("id", id).maybeSingle<{ stripe_ref: string | null; status: string }>();
  if (row?.stripe_ref && row.status === "invoiced") {
    try { await stripe().invoiceItems.update(row.stripe_ref, { amount, description: `WashLoop · ${description}` }); } catch { /* già fatturato: solo DB */ }
  }
  await svc.from("customer_charges").update({ description, amount_cents: amount }).eq("id", id);
  if (customerId) revalidatePath(`/admin/abbonati/${customerId}`);
}

/** Annulla un addebito (e prova a rimuovere l'invoice item se non ancora fatturato). */
export async function voidCustomerCharge(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  if (!id) throw new Error("Addebito mancante");
  const svc = createServiceClient();
  const { data: row } = await svc.from("customer_charges").select("stripe_ref, status").eq("id", id).maybeSingle<{ stripe_ref: string | null; status: string }>();
  if (row?.stripe_ref && row.status === "invoiced") {
    try { await stripe().invoiceItems.del(row.stripe_ref); } catch { /* già fatturato: ignora */ }
  }
  await svc.from("customer_charges").update({ status: "void" }).eq("id", id);
  if (customerId) revalidatePath(`/admin/abbonati/${customerId}`);
}
