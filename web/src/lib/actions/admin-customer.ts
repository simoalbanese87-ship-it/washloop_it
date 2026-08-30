"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { stripe, siteUrl } from "@/lib/stripe";
import { creaClienteStripe } from "@/lib/stripe-customer";
import { notifyNewCustomer, notifyRecurringChanged, notifyOrderStatus } from "@/lib/notify";
import { zoneIdForCap } from "@/lib/zones";
import { geocodeAddress } from "@/lib/geo";
import { ORDER_STATUS_LABEL, STATI_CHIUSI, type OrderStatus } from "@/lib/orders";
import { slotFullMessage } from "@/lib/slots";
import { inviaSollecito } from "@/lib/dunning";
import { ULTIMO_SOLLECITO } from "@/lib/dunning-piano";

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
      const c = await creaClienteStripe(svc, customerId, email);
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
      success_url: `${siteUrl()}/checkout/grazie?session_id={CHECKOUT_SESSION_ID}`,
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
    .select("id, user_id, status, stripe_subscription_id, manual, current_period_end")
    .eq("id", subId)
    .maybeSingle<{ id: string; user_id: string; status: string; stripe_subscription_id: string | null; manual: boolean; current_period_end: string | null }>();
  if (!sub) throw new Error("Abbonamento non trovato");

  const backTo = `/admin/abbonati/${sub.user_id}`;
  let warn: string | null = null;

  // Disdire un abbonamento già disdetto rispondeva "Abbonamento disdetto",
  // come se avesse fatto qualcosa: chi lo leggeva pensava che la disdetta di
  // prima non fosse andata a buon fine. Qui non si tocca niente e lo si dice.
  if (action === "cancel" && sub.status === "canceled") {
    redirect(`${backTo}?warn=${encodeURIComponent("Questo abbonamento era già disdetto: non ho cambiato niente.")}`);
  }

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
    await svc.from("subscriptions").update({ status: "active", current_period_end: periodEnd, canceled_at: null }).eq("id", subId);
    // Data attivazione: solo la prima volta (non sovrascrivere se già valorizzata).
    await svc.from("subscriptions").update({ activated_at: new Date().toISOString() }).eq("id", subId).is("activated_at", null);
  } else {
    const status = action === "pause" ? "paused" : action === "cancel" ? "canceled" : "active";
    // Data di disdetta per il churn: valorizza su cancel, azzera su resume.
    const patch: Record<string, unknown> = { status };
    if (action === "cancel") patch.canceled_at = new Date().toISOString();
    else if (action === "resume") patch.canceled_at = null;
    await svc.from("subscriptions").update(patch).eq("id", subId);
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
      block = "Cliente con abbonamento attivo: disdicilo prima di eliminare (così si ferma anche l'addebito Stripe).";
    } else {
      // Blocca solo gli ordini IN CORSO (bucato in lavorazione). Gli ordini
      // chiusi (consegnati/completati/annullati) vengono rimossi in cascata.
      //
      // Il messaggio elenca QUALI: prima diceva solo «completali o annullali»
      // senza dire quali fossero né dove trovarli, e si finiva per riprovare
      // a eliminare sbattendo ogni volta sullo stesso muro.
      const { data: aperti } = await svc
        .from("orders")
        .select("id, status")
        .eq("customer_id", customerId)
        .not("status", "in", `(${STATI_CHIUSI.join(",")})`)
        .order("created_at", { ascending: true })
        .returns<{ id: string; status: OrderStatus }[]>();
      const quanti = (aperti ?? []).length;
      if (quanti > 0) {
        const elenco = (aperti ?? [])
          .slice(0, 3)
          .map((o) => `#${o.id.slice(0, 8)} (${ORDER_STATUS_LABEL[o.status] ?? o.status})`)
          .join(", ");
        const resto = quanti > 3 ? ` e altri ${quanti - 3}` : "";
        block =
          quanti === 1
            ? `C'è ancora un ordine aperto: ${elenco}. Annullalo dalla sezione "Ordini" della scheda, poi riprova.`
            : `Ci sono ${quanti} ordini ancora aperti: ${elenco}${resto}. Annullali dalla sezione "Ordini" della scheda, poi riprova.`;
      }
    }
  }
  if (block) redirect(`${backTo}?warn=${encodeURIComponent(block)}`);

  // Elimina l'utente auth → cascade su profiles/addresses/subscriptions/customer_charges.
  const { error } = await svc.auth.admin.deleteUser(customerId);
  if (error) redirect(`${backTo}?warn=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/abbonati");
  redirect(`/admin/abbonati?ok=${encodeURIComponent("Lead eliminato.")}`);
}

// ---- Ritiri ricorrenti: l'admin vede/modifica gli orari indicati dal cliente ----

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valida e normalizza i campi di una ricorrenza dal form. `delivery` (orario di
 *  consegna preferito) è opzionale. */
function parseRecurring(formData: FormData): { weekday: number; hhmm: string; bags: number; delivery: string | null } {
  const weekday = parseInt(String(formData.get("weekday") ?? ""), 10);
  const hhmm = String(formData.get("hhmm") ?? "").trim();
  const bags = parseInt(String(formData.get("bags") ?? "1"), 10);
  const deliveryRaw = String(formData.get("delivery_hhmm") ?? "").trim();
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("Giorno non valido");
  if (!HHMM_RE.test(hhmm)) throw new Error("Orario non valido (usa HH:MM)");
  if (!Number.isInteger(bags) || bags < 1) throw new Error("Numero sacchi non valido");
  if (deliveryRaw && !HHMM_RE.test(deliveryRaw)) throw new Error("Orario di consegna non valido (usa HH:MM)");
  return { weekday, hhmm, bags, delivery: deliveryRaw || null };
}

/** Admin: propone una modifica a un ritiro ricorrente. La modifica NON è subito
 *  effettiva: resta "in sospeso" (pending_*) finché il cliente non la conferma in
 *  app. Fino ad allora il cron continua a usare l'orario attuale. */
export async function updateRecurringPickup(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("rec_id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  if (!id || !customerId) throw new Error("Parametri mancanti");
  const { weekday, hhmm, bags, delivery } = parseRecurring(formData);

  const svc = createServiceClient();
  const { error } = await svc
    .from("recurring_pickups")
    .update({
      pending_weekday: weekday,
      pending_hhmm: hhmm,
      pending_bags: bags,
      pending_delivery_hhmm: delivery,
      needs_confirmation: true,
      updated_by_admin_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("customer_id", customerId);
  if (error) throw new Error(error.message);

  await notifyRecurringChanged(customerId, { weekday, hhmm, bags, delivery });
  revalidatePath(`/admin/abbonati/${customerId}`);
  redirect(`/admin/abbonati/${customerId}?ok=${encodeURIComponent("Modifica proposta. In sospeso finché il cliente non la conferma in app (fino ad allora vale l'orario attuale).")}`);
}

/** Admin: crea un nuovo ritiro ricorrente. Nasce "in sospeso" (active=false):
 *  diventa attivo solo dopo la conferma del cliente in app. */
export async function addRecurringPickup(formData: FormData) {
  await requireAdmin();
  const customerId = String(formData.get("customer_id") ?? "");
  const addressId = String(formData.get("address_id") ?? "");
  if (!customerId || !addressId) throw new Error("Cliente o indirizzo mancante");
  const { weekday, hhmm, bags, delivery } = parseRecurring(formData);

  const svc = createServiceClient();
  const { error } = await svc.from("recurring_pickups").insert({
    customer_id: customerId,
    address_id: addressId,
    weekday, hhmm, bags,
    delivery_hhmm: delivery,
    active: false, // in sospeso: si attiva alla conferma del cliente
    needs_confirmation: true,
    updated_by_admin_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  await notifyRecurringChanged(customerId, { weekday, hhmm, bags, delivery });
  revalidatePath(`/admin/abbonati/${customerId}`);
  redirect(`/admin/abbonati/${customerId}?ok=${encodeURIComponent("Ritiro proposto. Si attiva quando il cliente lo conferma in app.")}`);
}

/** Admin: attiva/disattiva un ritiro ricorrente. */
export async function setRecurringActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("rec_id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id || !customerId) throw new Error("Parametri mancanti");

  const svc = createServiceClient();
  await svc.from("recurring_pickups").update({ active }).eq("id", id).eq("customer_id", customerId);
  revalidatePath(`/admin/abbonati/${customerId}`);
  redirect(`/admin/abbonati/${customerId}?ok=${encodeURIComponent(active ? "Ritiro riattivato." : "Ritiro disattivato.")}`);
}

/** Admin: aggiunge un indirizzo al cliente.
 *
 *  Serviva perché un cliente creato dal pannello nasce senza: `createCustomer`
 *  non tocca `addresses`, e fino a qui la scheda li mostrava in sola lettura.
 *  Risultato: non si poteva né creargli un ritiro ricorrente né un ritiro
 *  singolo, e l'unica via era entrare nei suoi panni e compilare il form
 *  dell'app. Stessa derivazione di zona e coordinate di `createOnboardingAddress`
 *  — quella lavora sull'utente in sessione, questa su un utente qualsiasi. */
export async function addCustomerAddress(formData: FormData) {
  await requireAdmin();
  const customerId = String(formData.get("customer_id") ?? "");
  const street = String(formData.get("street") ?? "").trim();
  const civico = String(formData.get("civico") ?? "").trim();
  const cap = String(formData.get("cap") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || "Milano";
  const label = String(formData.get("label") ?? "").trim() || "Casa";
  const intercom = String(formData.get("intercom") ?? "").trim();
  const floor = String(formData.get("floor") ?? "").trim();
  const accessMode = String(formData.get("access_mode") ?? "door");
  const accessNote = String(formData.get("access_note") ?? "").trim();
  const conciergeHours = String(formData.get("concierge_hours") ?? "").trim();

  const back = (params: Record<string, string>) =>
    `/admin/abbonati/${customerId}?${new URLSearchParams(params)}`;
  if (!customerId) throw new Error("Cliente mancante");
  if (!street || !civico) redirect(back({ warn: "Via e numero civico sono obbligatori." }));

  const svc = createServiceClient();
  const zoneId = await zoneIdForCap(svc, cap);
  const geo = await geocodeAddress({ street, civico, cap, city });
  const fullStreet = [`${street} ${civico}`.trim(), cap, city].filter(Boolean).join(", ");

  const { error } = await svc.from("addresses").insert({
    user_id: customerId,
    label,
    street: fullStreet,
    cap: cap || null,
    civico: civico || null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    zone_id: zoneId,
    intercom: accessMode !== "concierge" ? intercom || null : null,
    floor: accessMode !== "concierge" ? floor || null : null,
    access_mode: accessMode,
    access_note: accessNote || null,
    concierge_hours: accessMode === "concierge" ? conciergeHours || null : null,
  });
  if (error) redirect(back({ warn: `Indirizzo non salvato: ${error.message}` }));

  revalidatePath(`/admin/abbonati/${customerId}`);
  redirect(back({
    ok: zoneId
      ? "Indirizzo aggiunto."
      : "Indirizzo aggiunto, ma il CAP non è mappato a nessuna zona attiva: assegnala a mano prima del ritiro.",
  }));
}

/** Admin: crea un ritiro per conto del cliente.
 *
 *  Non passa da `bookPickup` di proposito. Quella è l'azione del cliente e ha
 *  il gate sull'abbonamento attivo: con un pagamento fallito si rifiuta — che è
 *  giusto per il cliente e sbagliato qui, perché è proprio il caso in cui
 *  l'operatore deve poter prenotare al telefono. Resta traccia di chi l'ha
 *  creato in `staff_notes`: un ordine comparso dal nulla nel board, senza dire
 *  da dove viene, è peggio del problema che risolve. */
export async function adminCreatePickup(formData: FormData) {
  await requireAdmin();
  const customerId = String(formData.get("customer_id") ?? "");
  const addressId = String(formData.get("address_id") ?? "");
  const pickupSlotId = String(formData.get("pickup_slot_id") ?? "");
  const deliverySlotId = String(formData.get("delivery_slot_id") ?? "");
  const bags = Math.max(1, Number(formData.get("bags") ?? 1) || 1);
  const notes = String(formData.get("notes") ?? "").trim();

  const back = (params: Record<string, string>) =>
    `/admin/abbonati/${customerId}?${new URLSearchParams(params)}`;
  if (!customerId) throw new Error("Cliente mancante");
  if (!addressId || !pickupSlotId) redirect(back({ warn: "Indirizzo e fascia di ritiro sono obbligatori." }));

  const svc = createServiceClient();
  const [{ data: slot }, { data: sub }] = await Promise.all([
    svc.from("slots").select("starts_at, laundry_id").eq("id", pickupSlotId).maybeSingle<{ starts_at: string; laundry_id: string | null }>(),
    svc.from("subscriptions").select("plans(turnaround_hours)").eq("user_id", customerId)
      .order("created_at", { ascending: false }).limit(1)
      .maybeSingle<{ plans: { turnaround_hours: number } | null }>(),
  ]);
  if (!slot) redirect(back({ warn: "Fascia di ritiro non trovata." }));

  const turnaround = sub?.plans?.turnaround_hours ?? 48;
  const eta = new Date(new Date(slot!.starts_at).getTime() + turnaround * 3600_000).toISOString();

  const { data, error } = await svc
    .from("orders")
    .insert({
      customer_id: customerId,
      address_id: addressId,
      pickup_slot_id: pickupSlotId,
      delivery_slot_id: deliverySlotId || null,
      laundry_id: slot!.laundry_id,
      eta_ready_at: eta,
      bags,
      notes: notes || null,
      staff_notes: "Ritiro creato dall'amministrazione per conto del cliente.",
      status: "pickup_scheduled" as OrderStatus,
    })
    .select("id")
    .single();
  if (error) redirect(back({ warn: slotFullMessage(error) ?? `Ritiro non creato: ${error.message}` }));

  await notifyOrderStatus(data!.id, "pickup_scheduled");
  revalidatePath(`/admin/abbonati/${customerId}`);
  revalidatePath("/admin/ordini");
  redirect(`/admin/ordini/${data!.id}?ok=${encodeURIComponent("Ritiro creato per conto del cliente. Il cliente è stato avvisato.")}`);
}

/** Admin: manda subito un sollecito di pagamento, senza aspettare il cron.
 *
 *  Serve perché la catena automatica parte da un fallimento NUOVO segnalato da
 *  Stripe: chi era già bloccato prima che il recupero esistesse — o chi è in
 *  `past_due` da tanto che Stripe ha smesso di ritentare — non riceverebbe mai
 *  niente. Il primo sollecito lo fa partire una persona; dal secondo in poi
 *  riprende il calendario automatico, perché questa azione scrive lo stesso
 *  contatore che legge il cron.
 *
 *  Se non abbiamo il link della fattura (fallimenti precedenti a questa
 *  funzione) lo si va a cercare su Stripe: senza, il cliente riceverebbe un
 *  sollecito che non gli dice dove pagare. */
export async function sollecitaOra(formData: FormData) {
  await requireAdmin();
  const customerId = String(formData.get("customer_id") ?? "");
  const subId = String(formData.get("sub_id") ?? "");
  const back = (params: Record<string, string>) => `/admin/abbonati/${customerId}?${new URLSearchParams(params)}`;
  if (!customerId || !subId) throw new Error("Parametri mancanti");

  const svc = createServiceClient();
  const { data: sub } = await svc
    .from("subscriptions")
    .select("id, status, dunning_step, last_failed_invoice_url, stripe_customer_id")
    .eq("id", subId)
    .maybeSingle<{ id: string; status: string; dunning_step: number | null; last_failed_invoice_url: string | null; stripe_customer_id: string | null }>();
  if (!sub) redirect(back({ warn: "Abbonamento non trovato." }));
  if (!["past_due", "unpaid"].includes(sub!.status)) {
    redirect(back({ warn: "Non c'è niente da sollecitare: l'abbonamento non ha pagamenti in sospeso." }));
  }

  // Link di pagamento: quello salvato, oppure la fattura aperta più recente.
  let invoiceUrl = sub!.last_failed_invoice_url;
  if (!invoiceUrl && sub!.stripe_customer_id) {
    try {
      const aperte = await stripe().invoices.list({ customer: sub!.stripe_customer_id, status: "open", limit: 1 });
      invoiceUrl = aperte.data[0]?.hosted_invoice_url ?? null;
      if (invoiceUrl) {
        await svc.from("subscriptions").update({ last_failed_invoice_url: invoiceUrl }).eq("id", sub!.id);
      }
    } catch (err) {
      // Chiave mancante, cliente sparito da Stripe: il sollecito parte lo
      // stesso, con il link alla pagina abbonamento invece che alla fattura.
      console.error("[admin] fattura aperta non recuperata:", err);
    }
  }

  const [{ data: prof }, { data: utente }] = await Promise.all([
    svc.from("profiles").select("full_name").eq("id", customerId).maybeSingle<{ full_name: string | null }>(),
    svc.auth.admin.getUserById(customerId),
  ]);
  const email = utente?.user?.email ?? null;
  if (!email) redirect(back({ warn: "Il cliente non ha un'email: impossibile sollecitare." }));

  // Il prossimo della serie. Arrivati al terzo non si va oltre: si può
  // rimandare quello, ma il contatore resta fermo — tre avvisi automatici sono
  // il limite che ci siamo dati.
  const step = Math.min((sub!.dunning_step ?? 0) + 1, ULTIMO_SOLLECITO);

  const esito = await inviaSollecito({
    subscriptionId: sub!.id,
    step,
    invoiceUrl,
    destinatario: { userId: customerId, email, nome: prof?.full_name ?? null },
  });
  if (!esito.inviato) redirect(back({ warn: `Sollecito non registrato: ${esito.motivo ?? "errore"}` }));

  revalidatePath(`/admin/abbonati/${customerId}`);
  redirect(back({
    ok: invoiceUrl
      ? `Sollecito ${step} di 3 inviato, con il link alla fattura da saldare.`
      : `Sollecito ${step} di 3 inviato. Nessuna fattura aperta trovata su Stripe: il link porta alla pagina abbonamento.`,
  }));
}
