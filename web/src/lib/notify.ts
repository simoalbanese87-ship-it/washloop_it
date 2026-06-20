import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMail, renderEmail } from "@/lib/email";
import type { OrderStatus } from "@/lib/orders";

/** Testo email per gli stati ordine rilevanti per il cliente.
 *  Gli stati non elencati non generano email (evita spam). */
const TEMPLATES: Partial<
  Record<OrderStatus, { subject: string; title: string; emoji: string; preheader: string; body: (bags: number) => string }>
> = {
  pickup_scheduled: {
    subject: "Ritiro prenotato ✅",
    title: "Ritiro prenotato",
    emoji: "✅",
    preheader: "Tieni il bucato pronto per l'orario scelto: al resto pensiamo noi.",
    body: (b) =>
      `Abbiamo registrato il tuo ritiro di <strong>${b} ${b === 1 ? "sacco" : "sacchi"}</strong>. Tieni il bucato pronto per l'orario scelto: al ritiro, lavaggio e riconsegna pensiamo noi.`,
  },
  picked_up: {
    subject: "Bucato ritirato 🧺",
    title: "Abbiamo ritirato il tuo bucato",
    emoji: "🧺",
    preheader: "Il bucato è in viaggio verso la lavanderia.",
    body: () => `Il corriere ha ritirato il tuo bucato. Ora va in lavanderia per il trattamento: ti avvisiamo appena è pronto.`,
  },
  ready: {
    subject: "Il tuo bucato è pronto ✨",
    title: "Bucato pronto",
    emoji: "✨",
    preheader: "Lavato e pronto: a breve programmiamo la riconsegna.",
    body: () => `Il tuo bucato è lavato, piegato e pronto. A breve programmiamo la riconsegna: trovi i dettagli nella tua area personale.`,
  },
  out_for_delivery: {
    subject: "In consegna oggi 🚚",
    title: "Il tuo bucato è in consegna",
    emoji: "🚚",
    preheader: "Il corriere è in viaggio con il tuo bucato pulito.",
    body: () => `Il corriere è in viaggio con il tuo bucato pulito. Ci siamo quasi!`,
  },
  delivered: {
    subject: "Consegnato — a presto 👋",
    title: "Bucato consegnato",
    emoji: "👋",
    preheader: "Grazie per aver scelto WashLoop.",
    body: () => `Il tuo bucato è stato consegnato. Grazie per aver scelto WashLoop — a presto!`,
  },
};

/** Invia (best-effort) la notifica email al cliente per un cambio stato.
 *  Non lancia mai: un errore email non deve bloccare l'azione chiamante. */
export async function notifyOrderStatus(orderId: string, status: OrderStatus) {
  const tpl = TEMPLATES[status];
  if (!tpl) return;

  try {
    const svc = createServiceClient();
    const { data: order } = await svc
      .from("orders")
      .select("id, bags, customer_id")
      .eq("id", orderId)
      .single();
    if (!order?.customer_id) return;

    const { data: userRes } = await svc.auth.admin.getUserById(order.customer_id);
    const email = userRes?.user?.email;
    if (!email) return;

    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it").replace(/\s+/g, "");
    const html = renderEmail({
      title: tpl.title,
      body: tpl.body(order.bags ?? 1),
      emoji: tpl.emoji,
      preheader: tpl.preheader,
      cta: { label: "Vedi l'ordine", href: `${site}/app/ordini/${orderId}` },
    });
    await sendMail({ to: email, subject: tpl.subject, html });
  } catch (err) {
    console.error(`[notify] notifyOrderStatus(${orderId}, ${status}) fallita:`, err);
  }
}
