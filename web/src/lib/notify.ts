import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMail, renderEmail } from "@/lib/email";
import { welcomeEmailHtml } from "@/lib/email-templates";
import { LEGAL } from "@/lib/legal";
import { sendPush } from "@/lib/push";
import { fmtFull, fmtSlot, WEEKDAY_IT } from "@/lib/format";
import type { OrderStatus } from "@/lib/orders";
import {
  SEGNALAZIONE_AL_CLIENTE,
  SEGNALAZIONE_LABEL,
  avvisaSubitoIlCliente,
  type TipoSegnalazione,
} from "@/lib/segnalazioni";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it").replace(/\s+/g, "");

/** Email + push al CLIENTE per gli stati rilevanti. Gli stati non elencati non
 *  notificano (evita spam). */
const CUSTOMER: Partial<
  Record<OrderStatus, { subject: string; title: string; emoji: string; preheader: string; body: (bags: number, fascia: string) => string; push: string }>
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
  delivery_failed: {
    subject: "Non ti abbiamo trovato in casa",
    title: "Consegna non riuscita",
    emoji: "🔔",
    preheader: "Riproviamo: dicci quando ti troviamo.",
    body: () =>
      `Il corriere è passato ma non è riuscito a consegnare. Nessun problema: il tuo bucato è al sicuro da noi. Rispondi a questa email o scrivici dall'area personale per concordare un nuovo passaggio.`,
    push: "Consegna non riuscita: scrivici per riprovare.",
  },
  cancelled: {
    subject: "Ritiro annullato",
    title: "Ritiro annullato",
    emoji: "✖️",
    preheader: "Il ritiro è stato annullato.",
    body: () => `Il tuo ritiro è stato annullato. Se non sei stato tu, scrivici: ci pensiamo subito.`,
    push: "Il tuo ritiro è stato annullato.",
  },
  ready: {
    subject: "Il tuo bucato è pronto ✨",
    title: "Bucato pronto",
    emoji: "✨",
    preheader: "Lavato e pronto: a breve programmiamo la riconsegna.",
    body: () => `Il tuo bucato è lavato, piegato e pronto. A breve programmiamo la riconsegna: trovi i dettagli nella tua area personale.`,
    push: "Il tuo bucato è pronto ✨",
  },
  delivery_scheduled: {
    subject: "Riconsegna programmata 🚚",
    title: "Riconsegna programmata",
    emoji: "🚚",
    preheader: "Abbiamo fissato quando ti riportiamo il bucato.",
    body: (_b, fascia) =>
      `Abbiamo organizzato la riconsegna del tuo bucato${fascia ? `: <strong>${fascia}</strong>` : "."} Non devi fare nulla, ci pensiamo noi. Se a quell'ora non ci sei, rispondi a questa email e spostiamo il passaggio.`,
    push: "Riconsegna programmata 🚚",
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
      .select("id, bags, customer_id, laundry_id, service, fragrance, eta_ready_at, delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)")
      .eq("id", orderId)
      .single();
    if (!order) return;

    // Fascia di riconsegna in chiaro: la usa il testo di `delivery_scheduled`,
    // per gli altri stati resta vuota e i testi la ignorano.
    // L'embed PostgREST è tipizzato come array anche quando la relazione è
    // uno-a-uno: normalizziamo prima di usarlo.
    const rel = order.delivery_slot as unknown as { starts_at: string; ends_at: string }[] | { starts_at: string; ends_at: string } | null;
    const ds = Array.isArray(rel) ? rel[0] : rel;
    const fascia = ds ? fmtSlot(ds.starts_at, ds.ends_at) : "";

    // ---- Cliente: email + push ----
    if (cust && order.customer_id) {
      const email = await userEmail(svc, order.customer_id);
      if (email) {
        const html = renderEmail({
          title: cust.title,
          body: cust.body(order.bags ?? 1, fascia),
          emoji: cust.emoji,
          preheader: cust.preheader,
          cta: { label: "Vedi i dettagli", href: `${site()}/app/ordini/${orderId}` },
        });
        await sendMail({ to: email, subject: cust.subject, html });
      }
      await sendPush(order.customer_id, { title: cust.title, body: fascia && status === "delivery_scheduled" ? `Ti riportiamo il bucato ${fascia}` : cust.push, url: `/app/ordini/${orderId}` });
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
export async function notifyRecurringChanged(customerId: string, schedule: { weekday: number; hhmm: string; bags: number; delivery?: string | null }) {
  try {
    const svc = createServiceClient();
    const email = await userEmail(svc, customerId);
    const when = `Ogni ${WEEKDAY_IT[schedule.weekday] ?? "—"} alle ${schedule.hhmm}`;
    const bagsLabel = `${schedule.bags} ${schedule.bags === 1 ? "sacco" : "sacchi"}`;
    const deliveryLabel = schedule.delivery ? ` · consegna preferita alle ${schedule.delivery}` : "";
    if (email) {
      const html = renderEmail({
        title: "C'è una modifica al tuo ritiro",
        body: `Ti proponiamo un nuovo orario di ritiro: <strong>${when}</strong> · ${bagsLabel}${deliveryLabel}.<br/>La modifica <strong>non è ancora attiva</strong>: aprila in app e confermala. Fino ad allora vale l'orario attuale.`,
        emoji: "🕒",
        preheader: `Nuovo orario proposto: ${when}`,
        cta: { label: "Conferma in app", href: `${site()}/app` },
      });
      await sendMail({ to: email, subject: "Modifica al tuo ritiro — da confermare 🕒", html });
    }
    await sendPush(customerId, { title: "Modifica al tuo ritiro", body: `${when} · confermala in app`, url: "/app" });
  } catch (err) {
    console.error(`[notify] notifyRecurringChanged(${customerId}) fallita:`, err);
  }
}

/** Invia le credenziali di accesso a un membro dello staff appena creato
 *  (lavanderia / rider / sales). Best-effort. */
export async function notifyStaffAccount(input: { to: string; fullName: string; password: string; areaLabel: string; areaPath: string }) {
  try {
    const html = renderEmail({
      title: `Accesso ${input.areaLabel}`,
      body: `È stato creato il tuo accesso a <strong>${input.areaLabel}</strong> di WashLoop.<br/><br/>Email: <strong>${input.to}</strong><br/>Password temporanea: <strong>${input.password}</strong><br/><br/>Accedi e cambia la password dal tuo profilo.`,
      emoji: "🔐",
      preheader: `Le tue credenziali per ${input.areaLabel}`,
      cta: { label: "Accedi ora", href: `${site()}${input.areaPath}` },
    });
    await sendMail({ to: input.to, subject: `Il tuo accesso a ${input.areaLabel} — WashLoop 🔐`, html });
  } catch (err) {
    console.error(`[notify] notifyStaffAccount(${input.to}) fallita:`, err);
  }
}

/** Notifica immediata al cliente che un capo speciale è stato aggiunto e verrà
 *  addebitato sulla prossima fattura mensile. Best-effort (email + push). */
/** Benvenuto a chi si è registrato da solo dal sito.
 *
 *  Diverso da `notifyNewCustomer`, che serve agli account creati a mano
 *  dall'admin e contiene la password generata: qui la password l'ha scelta
 *  l'utente due secondi fa, ristamparla in un'email sarebbe solo un rischio.
 *  Prima di questa funzione chi si iscriveva dal sito non riceveva nulla: il
 *  primo contatto con WashLoop era il silenzio. */
export async function notifyWelcome(userId: string, email: string, fullName: string | null) {
  try {
    const nome = (fullName ?? "").trim().split(/\s+/)[0];
    await sendMail({
      to: email,
      subject: "Benvenuto in WashLoop 👋",
      html: renderEmail({
        title: nome ? `Ciao ${nome}, ci siamo!` : "Ci siamo!",
        body:
          `Il tuo account è attivo. Da qui in poi funziona così:<br/><br/>` +
          `<strong>1.</strong> Prenoti il ritiro scegliendo giorno e fascia oraria.<br/>` +
          `<strong>2.</strong> Passiamo noi a casa tua, tu lasci il sacco pronto.<br/>` +
          `<strong>3.</strong> Laviamo, stiriamo e ti riportiamo tutto: alla riconsegna pensiamo noi, ti avvisiamo con giorno e ora.<br/><br/>` +
          `Per ogni passaggio ricevi un avviso, così sai sempre dov'è il tuo bucato.`,
        emoji: "👋",
        preheader: "Il tuo account è attivo: ecco come funziona.",
        cta: { label: "Prenota il primo ritiro", href: `${site()}/app/prenota` },
      }),
    });
    await sendPush(userId, { title: "Benvenuto in WashLoop 👋", body: "Prenota il tuo primo ritiro.", url: "/app/prenota" });
  } catch (err) {
    console.error(`[notify] notifyWelcome(${userId}) fallita:`, err);
  }
}

/** Promemoria della sera prima: "domani passiamo". Non è un cambio di stato, per
 *  questo sta fuori dalla tabella CUSTOMER e non passa da notifyOrderStatus.
 *  Serve a ridurre i passaggi a vuoto, che sono il costo peggiore del servizio:
 *  il rider fa il giro, il sacco non c'è, e la tappa è persa comunque. */
export async function notifyPromemoria(
  customerId: string,
  input: { tipo: "ritiro" | "consegna"; fascia: string; orderId: string; bags: number },
) {
  try {
    const svc = createServiceClient();
    const email = await userEmail(svc, customerId);
    const ritiro = input.tipo === "ritiro";
    const title = ritiro ? "Domani passiamo a ritirare" : "Domani ti riportiamo il bucato";
    const body = ritiro
      ? `Domani passiamo da te <strong>${input.fascia}</strong> per il ritiro di ${input.bags} ${input.bags === 1 ? "sacco" : "sacchi"}. Lascia il bucato pronto all'orario concordato.`
      : `Domani ti riconsegniamo il bucato pulito <strong>${input.fascia}</strong>. Se a quell'ora non ci sei, rispondi a questa email: spostiamo il passaggio.`;

    if (email) {
      await sendMail({
        to: email,
        subject: ritiro ? "Domani ritiriamo il tuo bucato 🧺" : "Domani ti riportiamo il bucato 🚚",
        html: renderEmail({
          title,
          body,
          emoji: ritiro ? "🧺" : "🚚",
          preheader: `${ritiro ? "Ritiro" : "Consegna"} ${input.fascia}`,
          cta: { label: "Vedi i dettagli", href: `${site()}/app/ordini/${input.orderId}` },
        }),
      });
    }
    await sendPush(customerId, { title, body: input.fascia, url: `/app/ordini/${input.orderId}` });
  } catch (err) {
    console.error(`[notify] notifyPromemoria(${input.orderId}) fallita:`, err);
  }
}

export async function notifySpecialAdded(customerId: string, input: { itemName: string; priceCents: number; orderId: string }) {
  try {
    const svc = createServiceClient();
    const price = "€" + (input.priceCents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const email = await userEmail(svc, customerId);
    if (email) {
      const html = renderEmail({
        title: "Capo speciale aggiunto",
        body: `Nel tuo sacco abbiamo riconosciuto un capo speciale: <strong>${input.itemName}</strong> (${price}). Verrà addebitato in automatico sulla tua <strong>prossima fattura mensile</strong>, secondo il listino. Trovi il dettaglio nella tua area personale.`,
        emoji: "✨",
        preheader: `${input.itemName} · ${price} sulla prossima fattura`,
        cta: { label: "Vedi i dettagli", href: `${site()}/app/ordini/${input.orderId}` },
      });
      await sendMail({ to: email, subject: `Capo speciale aggiunto · ${price} ✨`, html });
    }
    await sendPush(customerId, { title: "Capo speciale aggiunto ✨", body: `${input.itemName} · ${price} sulla prossima fattura`, url: `/app/ordini/${input.orderId}` });
  } catch (err) {
    console.error(`[notify] notifySpecialAdded(${customerId}) fallita:`, err);
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

// ---------------------------------------------------------------------------
// Segnalazioni della lavanderia sui capi.

type SegnalazioneNotificabile = {
  id: string;
  order_id: string;
  kind: TipoSegnalazione;
  capo: string | null;
  testo: string;
  customer_id: string | null;
  /** Valorizzato solo se il ritardo ha spostato la riconsegna. */
  spostamento: { da: string | null; a: string } | null;
};

async function leggiSegnalazione(
  svc: ReturnType<typeof createServiceClient>,
  issueId: string,
): Promise<SegnalazioneNotificabile | null> {
  const { data } = await svc
    .from("order_issues")
    .select("id, order_id, kind, capo, testo, riconsegna_a, riconsegna_da, orders(customer_id)")
    .eq("id", issueId)
    .maybeSingle<{
      id: string; order_id: string; kind: TipoSegnalazione; capo: string | null; testo: string;
      riconsegna_a: string | null; riconsegna_da: string | null;
      orders: { customer_id: string | null } | { customer_id: string | null }[] | null;
    }>();
  if (!data) return null;
  // L'embed PostgREST arriva come array anche su relazione uno-a-uno.
  const rel = Array.isArray(data.orders) ? data.orders[0] : data.orders;

  // Le due fasce si leggono a parte: servono solo quando c'è stato uno
  // spostamento, cioè quasi mai, e non vale la pena appesantire ogni notifica.
  let spostamento: { da: string | null; a: string } | null = null;
  if (data.riconsegna_a) {
    const { data: fasce } = await svc
      .from("slots")
      .select("id, starts_at, ends_at")
      .in("id", [data.riconsegna_a, data.riconsegna_da].filter(Boolean) as string[])
      .returns<{ id: string; starts_at: string; ends_at: string }[]>();
    const a = (fasce ?? []).find((f) => f.id === data.riconsegna_a);
    const da = (fasce ?? []).find((f) => f.id === data.riconsegna_da);
    if (a) spostamento = { da: da ? fmtSlot(da.starts_at, da.ends_at) : null, a: fmtSlot(a.starts_at, a.ends_at) };
  }

  return { ...data, customer_id: rel?.customer_id ?? null, spostamento };
}

/** Avvisa il CLIENTE di una segnalazione (email + push). Da chiamare solo quando
 *  la segnalazione è pubblicata: sui danni succede dopo, quando l'ops ha deciso
 *  cosa proporre. Best-effort: non lancia mai. */
export async function notifySegnalazioneCliente(issueId: string) {
  try {
    const svc = createServiceClient();
    const s = await leggiSegnalazione(svc, issueId);
    if (!s?.customer_id) return;

    const capo = s.capo?.trim() || "Un capo del tuo sacco";
    const titolo = SEGNALAZIONE_LABEL[s.kind];
    const contesto = SEGNALAZIONE_AL_CLIENTE[s.kind];

    const email = await userEmail(svc, s.customer_id);
    if (email) {
      const html = renderEmail({
        title: titolo,
        // Prima cosa è successo, poi le parole esatte della lavanderia: il
        // cliente deve poter distinguere il nostro riassunto dal referto.
        // La data nuova, se c'è, chiude il messaggio — non ne parte un secondo:
        // «c'è una macchia» e «la consegna si sposta» sono la stessa notizia.
        body:
          `<strong>${capo}</strong><br/>${contesto}` +
          `<br/><br/><em>La lavanderia scrive:</em><br/>“${s.testo}”` +
          (s.spostamento
            ? `<br/><br/><strong>Per questo il tuo bucato arriva ${s.spostamento.a}</strong>` +
              (s.spostamento.da ? `, invece di ${s.spostamento.da}.` : ".")
            : ""),
        emoji: s.kind === "danno" ? "🛠️" : "👕",
        preheader: s.spostamento ? `${titolo} — arriva ${s.spostamento.a}` : `${titolo} — ${capo}`,
        cta: { label: "Vedi il ritiro", href: `${site()}/app/ordini/${s.order_id}` },
      });
      await sendMail({ to: email, subject: s.spostamento ? `${titolo} · nuova data di consegna` : `${titolo} · ${capo}`, html });
    }
    await sendPush(s.customer_id, {
      title: titolo,
      body: s.spostamento ? `${capo} — il bucato arriva ${s.spostamento.a}` : `${capo} — ${contesto}`,
      url: `/app/ordini/${s.order_id}`,
    });
  } catch (err) {
    console.error(`[notify] notifySegnalazioneCliente(${issueId}) fallita:`, err);
  }
}

/** Avvisa l'OPS che è arrivata una segnalazione. Sempre, per tutti e tre i tipi
 *  e prima ancora che il cliente ne sappia niente: sui danni siamo noi a dover
 *  decidere cosa proporre, e se non lo sappiamo non decide nessuno.
 *
 *  Va a tutti gli account admin: nessun indirizzo da configurare, e se domani
 *  se ne aggiunge uno riceve senza che nessuno tocchi le variabili d'ambiente. */
export async function notifySegnalazioneOps(issueId: string) {
  try {
    const svc = createServiceClient();
    const s = await leggiSegnalazione(svc, issueId);
    if (!s) return;

    const capo = s.capo?.trim() || "capo non indicato";
    const titolo = SEGNALAZIONE_LABEL[s.kind];
    const daPubblicare = !avvisaSubitoIlCliente(s.kind);

    const { data: admins } = await svc.from("profiles").select("id").eq("role", "admin");
    for (const a of admins ?? []) {
      const email = await userEmail(svc, a.id);
      if (email) {
        const html = renderEmail({
          title: `Segnalazione lavanderia: ${titolo}`,
          body:
            `<strong>${capo}</strong> — ordine #${s.order_id.slice(0, 8)}<br/>“${s.testo}”` +
            (s.spostamento
              ? `<br/><br/>Riconsegna spostata${s.spostamento.da ? ` da ${s.spostamento.da}` : ""} a <strong>${s.spostamento.a}</strong>.`
              : "") +
            (daPubblicare
              ? `<br/><br/><strong>Il cliente non è stato avvisato.</strong> È un danno in lavorazione: decidi cosa proporgli, poi pubblica la segnalazione dalla scheda dell'ordine.`
              : `<br/><br/>Il cliente è già stato avvisato.`),
          emoji: s.kind === "danno" ? "🚨" : "👕",
          preheader: `${titolo} — ${capo}`,
          cta: { label: "Apri l'ordine", href: `${site()}/admin/ordini/${s.order_id}` },
        });
        await sendMail({ to: email, subject: `${daPubblicare ? "DA GESTIRE · " : ""}${titolo} · ${capo}`, html });
      }
      await sendPush(a.id, {
        title: `${daPubblicare ? "Da gestire: " : ""}${titolo}`,
        body: `${capo} — ${s.testo.slice(0, 90)}`,
        url: `/admin/ordini/${s.order_id}`,
      });
    }
  } catch (err) {
    console.error(`[notify] notifySegnalazioneOps(${issueId}) fallita:`, err);
  }
}
