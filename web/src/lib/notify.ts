import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMail, renderEmail } from "@/lib/email";
import { welcomeEmailHtml } from "@/lib/email-templates";
import { LEGAL } from "@/lib/legal";
import { sendPush } from "@/lib/push";
import { fmtFull, fmtSlot, WEEKDAY_IT } from "@/lib/format";
import type { OrderStatus } from "@/lib/orders";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it").replace(/\s+/g, "");

/** Email + push al CLIENTE per gli stati rilevanti. Gli stati non elencati non
 *  notificano (evita spam). */
const CUSTOMER: Partial<
  Record<OrderStatus, { subject: string; title: string; emoji: string; preheader: string; body: (bags: number) => string; push: string }>
> = {
  pickup_scheduled: {
    subject: "Ritiro prenotato ✅",
    title: "Ritiro prenotato",
    emoji: "✅",
    preheader: "Tieni il bucato pronto per l'orario scelto: al resto pensiamo noi.",
    body: (b) =>
      `Abbiamo registrato il tuo ritiro di <strong>${b} ${b === 1 ? "sacco" : "sacchi"}</strong>. Tieni il bucato pronto per l'orario scelto: a ritiro, lavaggio e riconsegna pensiamo noi.`,
    push: "Ritiro registrato. Tieni pronto il bucato per l'orario scelto.",
  },
  picked_up: {
    subject: "Bucato ritirato 🧺",
    title: "Abbiamo ritirato il tuo bucato",
    emoji: "🧺",
    preheader: "Il bucato è in viaggio verso la lavanderia.",
    body: () => `Il corriere ha ritirato il tuo bucato. Ora va in lavanderia per il trattamento: ti avvisiamo appena è pronto.`,
    push: "Abbiamo ritirato il tuo bucato 🧺",
  },
  ready: {
    subject: "Il tuo bucato è pronto ✨",
    title: "Bucato pronto",
    emoji: "✨",
    preheader: "Lavato e pronto: a breve programmiamo la riconsegna.",
    body: () => `Il tuo bucato è lavato, piegato e pronto. A breve programmiamo la riconsegna: trovi i dettagli nella tua area personale.`,
    push: "Il tuo bucato è pronto ✨",
  },
  out_for_delivery: {
    subject: "In consegna oggi 🚚",
    title: "Il tuo bucato è in consegna",
    emoji: "🚚",
    preheader: "Il corriere è in viaggio con il tuo bucato pulito.",
    body: () => `Il corriere è in viaggio con il tuo bucato pulito. Ci siamo quasi!`,
    push: "Il tuo bucato è in consegna 🚚",
  },
  delivered: {
    subject: "Consegnato — a presto 👋",
    title: "Bucato consegnato",
    emoji: "👋",
    preheader: "Grazie per aver scelto WashLoop.",
    body: () => `Il tuo bucato è stato consegnato. Grazie per aver scelto WashLoop — a presto!`,
    push: "Bucato consegnato 👋 Grazie!",
  },
};

/** Email alla LAVANDERIA. Privacy partner: nessun dato personale del cliente
 *  (no nome/indirizzo/telefono) — solo info di lavorazione. */
const LAUNDRY: Partial<Record<OrderStatus, { subject: string; title: string; emoji: string }>> = {
  pickup_scheduled: { subject: "Nuovo ordine in arrivo 🧺", title: "Nuovo ordine WashLoop", emoji: "🧺" },
  picked_up: { subject: "Bucato in arrivo in lavanderia 🚚", title: "Bucato in arrivo", emoji: "🚚" },
};

async function userEmail(svc: ReturnType<typeof createServiceClient>, profileId: string | null): Promise<string | null> {
  if (!profileId) return null;
  const { data } = await svc.auth.admin.getUserById(profileId);
  return data?.user?.email ?? null;
}

/** Email contatto della lavanderia: colonna `laundries.email`, altrimenti email
 *  del profilo partner collegato. */
async function laundryEmail(svc: ReturnType<typeof createServiceClient>, laundryId: string | null): Promise<string | null> {
  if (!laundryId) return null;
  const { data: l } = await svc.from("laundries").select("email").eq("id", laundryId).maybeSingle<{ email: string | null }>();
  if (l?.email) return l.email;
  const { data: p } = await svc.from("profiles").select("id").eq("role", "partner").eq("laundry_id", laundryId).limit(1).maybeSingle<{ id: string }>();
  return p?.id ? userEmail(svc, p.id) : null;
}

/** Notifica (best-effort) cliente (email+push) e, se rilevante, la lavanderia.
 *  Non lancia mai: un errore notifica non deve bloccare l'azione chiamante. */
export async function notifyOrderStatus(orderId: string, status: OrderStatus) {
  const cust = CUSTOMER[status];
  const lav = LAUNDRY[status];
  if (!cust && !lav) return;

  try {
    const svc = createServiceClient();
    const { data: order } = await svc
      .from("orders")
      .select("id, bags, customer_id, laundry_id, service, fragrance, eta_ready_at")
      .eq("id", orderId)
      .single();
    if (!order) return;

    // ---- Cliente: email + push ----
    if (cust && order.customer_id) {
      const email = await userEmail(svc, order.customer_id);
      if (email) {
        const html = renderEmail({
          title: cust.title,
          body: cust.body(order.bags ?? 1),
          emoji: cust.emoji,
          preheader: cust.preheader,
          cta: { label: "Vedi l'ordine", href: `${site()}/app/ordini/${orderId}` },
        });
        await sendMail({ to: email, subject: cust.subject, html });
      }
      await sendPush(order.customer_id, { title: cust.title, body: cust.push, url: `/app/ordini/${orderId}` });
    }

    // ---- Lavanderia: push (webapp installata) + email (solo info lavorazione, no PII) ----
    if (lav && order.laundry_id) {
      const short = orderId.slice(0, 8);
      const plain = [
        `${order.bags ?? 1} ${order.bags === 1 ? "sacco" : "sacchi"}`,
        order.service || null,
        order.eta_ready_at ? `pronto entro ${fmtFull(order.eta_ready_at)}` : null,
      ].filter(Boolean).join(" · ");

      // Push a tutti i profili partner della lavanderia
      const { data: partners } = await svc.from("profiles").select("id").eq("role", "partner").eq("laundry_id", order.laundry_id);
      for (const p of partners ?? []) {
        await sendPush(p.id, { title: `${lav.title} · #${short}`, body: plain, url: "/laundry" });
      }

      // Email (best-effort, se configurata): colonna laundries.email o profilo partner
      const to = await laundryEmail(svc, order.laundry_id);
      if (to) {
        const extras = [
          `<strong>${order.bags ?? 1} ${order.bags === 1 ? "sacco" : "sacchi"}</strong>`,
          order.service ? `servizio: ${order.service}` : null,
          order.fragrance ? `fragranza: ${order.fragrance}` : null,
          order.eta_ready_at ? `pronto entro ${fmtFull(order.eta_ready_at)}` : null,
        ].filter(Boolean).join(" · ");
        const html = renderEmail({
          title: lav.title,
          body: `Ordine <strong>#${short}</strong> — ${extras}.${status === "picked_up" ? " Il bucato è stato ritirato ed è in arrivo." : " Verrà ritirato a breve."}`,
          emoji: lav.emoji,
          preheader: lav.subject,
          cta: { label: "Apri il portale", href: `${site()}/laundry` },
        });
        await sendMail({ to, subject: `${lav.subject} · #${short}`, html });
      }
    }
  } catch (err) {
    console.error(`[notify] notifyOrderStatus(${orderId}, ${status}) fallita:`, err);
  }
}

/** Email al RIDER quando gli viene assegnato un ordine (ritiro o consegna). */
export async function notifyCourierAssigned(orderId: string) {
  try {
    const svc = createServiceClient();
    const { data: order } = await svc
      .from("orders")
      .select("id, bags, status, courier_id, addresses(street), pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)")
      .eq("id", orderId)
      .single<{
        id: string; bags: number; status: OrderStatus; courier_id: string | null;
        addresses: { street: string } | null;
        pickup_slot: { starts_at: string; ends_at: string } | null;
        delivery_slot: { starts_at: string; ends_at: string } | null;
      }>();
    if (!order?.courier_id) return;
    const email = await userEmail(svc, order.courier_id);
    if (!email) return;

    const isDelivery = order.status === "delivery_scheduled" || order.status === "out_for_delivery";
    const slot = isDelivery ? order.delivery_slot : order.pickup_slot;
    const kind = isDelivery ? "consegna" : "ritiro";
    const when = slot ? fmtSlot(slot.starts_at, slot.ends_at) : "da programmare";
    const html = renderEmail({
      title: `Nuovo ${kind} assegnato`,
      body: `Ti è stato assegnato un <strong>${kind}</strong>.<br/>Indirizzo: ${order.addresses?.street ?? "—"}<br/>Quando: ${when}<br/>Sacchi: ${order.bags ?? 1}`,
      emoji: "📦",
      preheader: `Nuovo ${kind} nel tuo giro`,
      cta: { label: "Apri il giro", href: `${site()}/courier` },
    });
    await sendMail({ to: email, subject: `Nuovo ${kind} assegnato 📦`, html });
    await sendPush(order.courier_id, { title: `Nuovo ${kind} assegnato`, body: `${order.addresses?.street ?? ""} · ${when}`, url: "/courier" });
  } catch (err) {
    console.error(`[notify] notifyCourierAssigned(${orderId}) fallita:`, err);
  }
}

/** Notifica il cliente che l'admin ha aggiornato un suo orario di ritiro
 *  ricorrente. Chiede di confermare la presa visione in app. Best-effort. */
export async function notifyRecurringChanged(customerId: string, schedule: { weekday: number; hhmm: string; bags: number }) {
  try {
    const svc = createServiceClient();
    const email = await userEmail(svc, customerId);
    const when = `Ogni ${WEEKDAY_IT[schedule.weekday] ?? "—"} alle ${schedule.hhmm}`;
    const bagsLabel = `${schedule.bags} ${schedule.bags === 1 ? "sacco" : "sacchi"}`;
    if (email) {
      const html = renderEmail({
        title: "Abbiamo aggiornato il tuo ritiro",
        body: `Il tuo orario di ritiro ricorrente è stato aggiornato: <strong>${when}</strong> · ${bagsLabel}.<br/>Apri l'app e conferma la modifica: se qualcosa non va, puoi cambiarla o disattivarla tu.`,
        emoji: "🕒",
        preheader: `Nuovo orario di ritiro: ${when}`,
        cta: { label: "Conferma in app", href: `${site()}/app` },
      });
      await sendMail({ to: email, subject: "Orario di ritiro aggiornato 🕒", html });
    }
    await sendPush(customerId, { title: "Orario di ritiro aggiornato", body: `${when} · da confermare in app`, url: "/app" });
  } catch (err) {
    console.error(`[notify] notifyRecurringChanged(${customerId}) fallita:`, err);
  }
}

/** Email di benvenuto a un cliente creato dall'admin (mini-CRM): credenziali di
 *  accesso + piano. La password è temporanea: invitiamo a cambiarla. */
export async function notifyNewCustomer(input: {
  to: string;
  fullName: string;
  password: string;
  planName?: string | null;
  priceLabel?: string | null;
}) {
  try {
    const planLabel = input.planName ? `${input.planName}${input.priceLabel ? ` · ${input.priceLabel}/mese` : ""}` : null;
    const html = welcomeEmailHtml({
      fullName: input.fullName,
      email: input.to,
      password: input.password,
      planLabel,
      siteUrl: site(),
      legal: { company: LEGAL.company, vat: LEGAL.vat, address: LEGAL.address, email: LEGAL.email, phone: LEGAL.phone },
    });
    await sendMail({ to: input.to, subject: "Il tuo account WashLoop è attivo 🧺", html });
  } catch (err) {
    console.error(`[notify] notifyNewCustomer(${input.to}) fallita:`, err);
  }
}
