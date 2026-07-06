"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { stripe, siteUrl } from "@/lib/stripe";
import { notifyNewCustomer } from "@/lib/notify";

const eur = (c: number) => "€" + (c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  // Stato "incomplete" finché il pagamento non è confermato: NON è "active"
  // (active solo per chi ha pagato). L'admin lo attiva con "Segna come pagato".
  await svc.from("subscriptions").insert({
    user_id: uid,
    plan_id,
    status: "incomplete",
    manual: true,
    custom_price_cents: Number.isFinite(custom as number) ? custom : null,
    current_period_end: null,
  });

  // Email di benvenuto con credenziali + piano (best-effort)
  let planName: string | null = null;
  let priceLabel: string | null = custom != null ? eur(custom) : null;
  if (plan_id) {
    const { data: plan } = await svc.from("plans").select("name, price_month_cents").eq("id", plan_id).maybeSingle<{ name: string; price_month_cents: number }>();
    planName = plan?.name ?? null;
    if (priceLabel == null && plan) priceLabel = eur(plan.price_month_cents);
  }
  await notifyNewCustomer({ to: email, fullName: full_name, password, planName, priceLabel });

  revalidatePath("/admin/abbonati");
  redirect(`/admin/abbonati/${uid}`);
}

/** Crea un ABBONAMENTO PERSONALIZZATO a prezzo custom (ricorrente mensile) e
 *  ritorna il link Stripe Checkout da inviare al cliente: paga, salva la carta e
 *  da lì l'addebito si rinnova da solo ogni mese. Funziona anche per clienti
 *  senza carta. Alla conferma pagamento il webhook registra la subscription con
 *  `custom_price_cents`. Gli extra una-tantum restano gli "Addebiti personalizzati". */
export async function createCustomSubscriptionLink(
  input: { customer_id: string; description?: string; amount_eur: string },
): Promise<{ url: string } | { error: string }> {
  try {
    await requireAdmin();
    const customerId = String(input.customer_id ?? "");
    const amount = eurToCents(String(input.amount_eur ?? ""));
    const description = (input.description ?? "").trim() || "Abbonamento WashLoop personalizzato";
    if (!customerId) return { error: "Cliente mancante" };
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Importo non valido" };

    const svc = createServiceClient();
    const { data: au } = await svc.auth.admin.getUserById(customerId);
    const email = au?.user?.email;
    if (!email) return { error: "Email cliente non trovata" };

    // Riusa il Customer Stripe se il cliente ne ha già uno, altrimenti crealo.
    const { data: existing } = await svc
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", customerId)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ stripe_customer_id: string | null }>();
    let stripeCustomerId = existing?.stripe_customer_id ?? undefined;
    if (!stripeCustomerId) {
      const c = await stripe().customers.create({ email, metadata: { supabase_user_id: customerId } });
      stripeCustomerId = c.id;
    }

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      // Stessi metodi del checkout standard (no Klarna).
      payment_method_types: ["card", "link", "amazon_pay"],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          product_data: { name: description },
          unit_amount: amount,
          recurring: { interval: "month" },
        },
      }],
      success_url: `${siteUrl()}/app?checkout=success`,
      cancel_url: `${siteUrl()}/app/abbonamento?checkout=cancel`,
      metadata: { supabase_user_id: customerId, custom_price_cents: String(amount) },
      subscription_data: { metadata: { supabase_user_id: customerId, custom_price_cents: String(amount) } },
    });
    if (!session.url) return { error: "Stripe non ha restituito un link" };
    return { url: session.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore nella creazione del link" };
  }
}

/** Reinvia le credenziali a un cliente: genera una nuova password temporanea e
 *  manda l'email di accesso. Utile se la prima email non è arrivata. */
export async function resendCredentials(formData: FormData) {
  await requireAdmin();
  const customerId = String(formData.get("customer_id") ?? "");
  if (!customerId) throw new Error("Cliente mancante");
  const svc = createServiceClient();

  const { data: au } = await svc.auth.admin.getUserById(customerId);
  const email = au?.user?.email;
  if (!email) throw new Error("Email cliente non trovata");

  const password = `WL!${crypto.randomBytes(4).toString("hex")}`;
  const { error } = await svc.auth.admin.updateUserById(customerId, { password });
  if (error) throw new Error(error.message);

  const { data: prof } = await svc.from("profiles").select("full_name").eq("id", customerId).maybeSingle<{ full_name: string | null }>();
  const { data: sub } = await svc
    .from("subscriptions")
    .select("custom_price_cents, plans(name, price_month_cents)")
    .eq("user_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ custom_price_cents: number | null; plans: { name: string; price_month_cents: number } | null }>();
  const priceLabel = sub?.custom_price_cents != null ? eur(sub.custom_price_cents) : sub?.plans ? eur(sub.plans.price_month_cents) : null;

  await notifyNewCustomer({ to: email, fullName: prof?.full_name ?? "Cliente", password, planName: sub?.plans?.name ?? null, priceLabel });
  revalidatePath(`/admin/abbonati/${customerId}`);
}

/** Pausa / riprendi / disdici / **attiva** l'abbonamento (Stripe se collegato,
 *  altrimenti DB). "activate" = conferma pagamento per gli abbonamenti manuali:
 *  porta lo stato ad "active" e imposta il periodo. */
export async function changeSubscription(formData: FormData) {
  await requireAdmin();
  const subId = String(formData.get("sub_id") ?? "");
  const action = String(formData.get("action") ?? ""); // pause | resume | cancel | activate
  if (!subId || !action) throw new Error("Parametri mancanti");

  const svc = createServiceClient();
  const { data: sub } = await svc
    .from("subscriptions")
    .select("id, user_id, stripe_subscription_id, manual, current_period_end")
    .eq("id", subId)
    .maybeSingle<{ id: string; user_id: string; stripe_subscription_id: string | null; manual: boolean; current_period_end: string | null }>();
  if (!sub) throw new Error("Abbonamento non trovato");

  const backTo = `/admin/abbonati/${sub.user_id}`;
  let warn: string | null = null;

  const stripeId = sub.stripe_subscription_id;
  if (stripeId) {
    // Best-effort: se la subscription non esiste più nell'account/modalità Stripe
    // corrente (es. sub di test con chiave live), NON deve far crashare l'azione.
    // Il DB resta la fonte di verità lato admin; il webhook riallinea se serve.
    try {
      const sk = stripe();
      if (action === "pause") await sk.subscriptions.update(stripeId, { pause_collection: { behavior: "void" } });
      else if (action === "resume") await sk.subscriptions.update(stripeId, { pause_collection: null });
      else if (action === "cancel") await sk.subscriptions.update(stripeId, { cancel_at_period_end: true });
    } catch (e) {
      warn = "Stato aggiornato su WashLoop (Stripe non ha trovato l'abbonamento collegato).";
      console.error("[changeSubscription] Stripe error:", e);
    }
  }

  if (action === "activate") {
    // Conferma pagamento (manuale): attiva e fissa/rinnova il periodo a 30gg.
    const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await svc.from("subscriptions").update({ status: "active", current_period_end: periodEnd }).eq("id", subId);
    // Data attivazione: solo la prima volta (non sovrascrivere se già valorizzata).
    await svc.from("subscriptions").update({ activated_at: new Date().toISOString() }).eq("id", subId).is("activated_at", null);
  } else {
    const status = action === "pause" ? "paused" : action === "cancel" ? "canceled" : "active";
    await svc.from("subscriptions").update({ status }).eq("id", subId);
  }

  const okMsg: Record<string, string> = {
    pause: "Abbonamento messo in pausa.",
    resume: "Abbonamento ripreso.",
    cancel: "Abbonamento disdetto.",
    activate: "Abbonamento attivato.",
  };
  revalidatePath(backTo);
  redirect(`${backTo}?${warn ? `warn=${encodeURIComponent(warn)}` : `ok=${encodeURIComponent(okMsg[action] ?? "Fatto.")}`}`);
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

/** Elimina definitivamente un lead/cliente e tutti i suoi dati (profilo, indirizzi,
 *  abbonamenti, addebiti — cascade via auth.users). Guardie di sicurezza: non
 *  eliminabile se ha un abbonamento attivo/in prova/sospeso o uno storico ordini
 *  (in quei casi va prima disdetto/gestito). Pensata per i lead pending/incompleti. */
export async function deleteCustomer(formData: FormData) {
  await requireAdmin();
  const customerId = String(formData.get("customer_id") ?? "");
  if (!customerId) throw new Error("Cliente mancante");
  const svc = createServiceClient();
  const backTo = `/admin/abbonati/${customerId}`;

  // Le condizioni che impediscono l'eliminazione NON sono errori di sistema:
  // vengono mostrate come banner nella pagina cliente, senza pagina d'errore.
  const { data: prof } = await svc.from("profiles").select("role").eq("id", customerId).maybeSingle<{ role: string }>();
  if (!prof) redirect(`/admin/abbonati?warn=${encodeURIComponent("Cliente non trovato.")}`);

  let block: string | null = null;
  if (prof!.role !== "customer") {
    block = "Si possono eliminare solo i clienti.";
  } else {
    const { data: sub } = await svc
      .from("subscriptions")
      .select("status")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string }>();
    if (sub && ["active", "trialing", "past_due"].includes(sub.status)) {
      block = "Cliente con abbonamento attivo: disdicilo prima di eliminare.";
    } else {
      const { count } = await svc.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", customerId);
      if ((count ?? 0) > 0) block = "Cliente con ordini nello storico: non eliminabile.";
    }
  }
  if (block) redirect(`${backTo}?warn=${encodeURIComponent(block)}`);

  // Elimina l'utente auth → cascade su profiles/addresses/subscriptions/customer_charges.
  const { error } = await svc.auth.admin.deleteUser(customerId);
  if (error) redirect(`${backTo}?warn=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/abbonati");
  redirect(`/admin/abbonati?ok=${encodeURIComponent("Lead eliminato.")}`);
}
