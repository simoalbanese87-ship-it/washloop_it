import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { incassiStripePerMese } from "@/lib/incassi-stripe";
import { waitlistLeads } from "@/lib/waitlist";

/** Aggregatori per la dashboard admin. Tutti gli importi sono in cent EUR.
 *  Le finestre mese/anno usano i confini locali (Europe/Rome, approssimati
 *  all'UTC della data di Roma: scarto max ~2h ai bordi, irrilevante). */

function bounds() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m] = parts.split("-").map(Number);
  return {
    monthStart: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    yearStart: new Date(Date.UTC(y, 0, 1)).toISOString(),
  };
}

const ACTIVE = ["active", "trialing"];

/** Un abbonamento conta come attivo solo se lo stato lo dice E il periodo non è
 *  finito. Guardare solo lo stato faceva contare nel ricorrente 440 € di due
 *  account di prova il cui periodo era scaduto da settimane: lo stato resta
 *  "active" finché Stripe (o un admin) non lo cambia, e per gli abbonamenti
 *  manuali non lo cambia mai nessuno. */
function abbonamentoVivo(s: { status: string; current_period_end: string | null }): boolean {
  if (!ACTIVE.includes(s.status)) return false;
  if (!s.current_period_end) return true; // periodo non noto: si crede allo stato
  return new Date(s.current_period_end).getTime() >= Date.now();
}

export type AbbonamentoAttivo = {
  userId: string;
  nome: string;
  prezzoCents: number;
  piano: string | null;
  fino: string | null;
  manuale: boolean;
};

/** Gli abbonamenti che compongono il ricorrente, uno per cliente.
 *
 *  Tre correzioni rispetto a prima, tutte necessarie perché il numero fosse
 *  vero: si esclude chi è marcato come account di prova, si tiene UNA sola
 *  riga per utente (un cliente può averne più d'una — una creata a mano
 *  dall'admin e una dal webhook Stripe, che fa upsert sull'id Stripe e quindi
 *  ne aggiunge una nuova invece di aggiornare quella manuale), e si scartano i
 *  periodi scaduti. */
export async function abbonamentiAttivi(includiProva = false): Promise<AbbonamentoAttivo[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("subscriptions")
    .select("user_id, status, manual, custom_price_cents, current_period_end, created_at, plans(name, price_month_cents), profiles(full_name, is_test)")
    .order("created_at", { ascending: false })
    .returns<{
      user_id: string; status: string; manual: boolean | null; custom_price_cents: number | null;
      current_period_end: string | null; created_at: string;
      plans: { name: string; price_month_cents: number } | null;
      profiles: { full_name: string | null; is_test: boolean } | null;
    }[]>();

  const vista = new Set<string>();
  const out: AbbonamentoAttivo[] = [];
  for (const r of data ?? []) {
    if (vista.has(r.user_id)) continue; // solo la più recente per cliente
    vista.add(r.user_id);
    if (!includiProva && r.profiles?.is_test) continue;
    if (!abbonamentoVivo(r)) continue;
    out.push({
      userId: r.user_id,
      nome: r.profiles?.full_name ?? "—",
      prezzoCents: r.custom_price_cents ?? r.plans?.price_month_cents ?? 0,
      piano: r.plans?.name ?? null,
      fino: r.current_period_end,
      manuale: r.manual === true,
    });
  }
  return out;
}

/** Normalizza un telefono a sole cifre (ultime 10) per confronti robusti. */
function normPhone(p: string | null | undefined): string {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

// ---------------- Ricavi (Core MRR + Extra) ----------------

export type RevenueMetrics = {
  coreMrrCents: number;
  coreYearProjCents: number;
  extraMonthCents: number;
  extraYearCents: number;
  /** Soldi realmente arrivati su Stripe nel mese / nell'anno. */
  incassatoMeseCents: number;
  incassatoAnnoCents: number;
};

export async function revenueMetrics(includiProva = false): Promise<RevenueMetrics> {
  const svc = createServiceClient();
  const { monthStart, yearStart } = bounds();

  const [attivi, { data: specials }, { data: charges }, { data: incassi }] = await Promise.all([
    abbonamentiAttivi(includiProva),
    svc.from("order_specials").select("price_cli_cents, qty, created_at, refunded_at, orders(status)").gte("created_at", yearStart)
      .returns<{ price_cli_cents: number; qty: number; created_at: string; refunded_at: string | null; orders: { status: string } | null }[]>(),
    svc.from("customer_charges").select("amount_cents, kind, created_at").neq("status", "void").gte("created_at", yearStart)
      .returns<{ amount_cents: number; kind: string; created_at: string }[]>(),
    svc.from("invoices").select("amount_cents, created_at, profiles(is_test)").gte("created_at", yearStart)
      .returns<{ amount_cents: number; created_at: string; profiles: { is_test: boolean } | null }[]>(),
  ]);

  // Gli incassi veri li sa Stripe. La tabella `invoices` si popola da un webhook
  // che non arriva, quindi da sola dava zero mentre gli abbonamenti venivano
  // pagati: resta come ripiego se Stripe non risponde.
  const stripePerMese = await incassiStripePerMese(Math.floor(new Date(yearStart).getTime() / 1000));

  const coreMrrCents = attivi.reduce((t, a) => t + a.prezzoCents, 0);

  let extraMonthCents = 0, extraYearCents = 0;
  for (const x of specials ?? []) {
    // Il capo rimborsato NON si conta qui e NON si sottrae dopo: il rimborso
    // scrive sia `refunded_at` sia una riga in customer_charges, e contarli
    // entrambi portava un capo da 10 € addebitato e rimborsato a −10 € invece
    // che a zero.
    if (x.refunded_at) continue;
    // Un capo di un ordine annullato non è un ricavo.
    if (x.orders?.status === "cancelled") continue;
    const v = (x.price_cli_cents ?? 0) * (x.qty ?? 1);
    extraYearCents += v;
    if (x.created_at >= monthStart) extraMonthCents += v;
  }
  for (const c of charges ?? []) {
    // Gli storni dei capi speciali sono già stati esclusi sopra togliendo il
    // capo: qui si contano solo gli addebiti e gli storni a sé stanti.
    if (c.kind === "refund") continue;
    const v = c.amount_cents ?? 0;
    extraYearCents += v;
    if (c.created_at >= monthStart) extraMonthCents += v;
  }

  let incassatoMeseCents = 0, incassatoAnnoCents = 0;
  if (stripePerMese) {
    const meseCorrente = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" })
      .format(new Date())
      .slice(0, 7);
    for (const [k, v] of stripePerMese) {
      incassatoAnnoCents += v.totaleCents;
      if (k === meseCorrente) incassatoMeseCents += v.totaleCents;
    }
  } else {
    for (const i of incassi ?? []) {
      if (!includiProva && i.profiles?.is_test) continue;
      incassatoAnnoCents += i.amount_cents ?? 0;
      if (i.created_at >= monthStart) incassatoMeseCents += i.amount_cents ?? 0;
    }
  }

  return { coreMrrCents, coreYearProjCents: coreMrrCents * 12, extraMonthCents, extraYearCents, incassatoMeseCents, incassatoAnnoCents };
}

// ---------------- Lavanderia (sacchi + compenso dovuto) ----------------

export type LaundryMetrics = { bagsMonth: number; bagsYear: number; laundryOwedMonthCents: number; laundryOwedYearCents: number };

export async function laundryMetrics(includiProva = false): Promise<LaundryMetrics> {
  const svc = createServiceClient();
  const { monthStart, yearStart } = bounds();

  // Il dovuto si legge dal REGISTRO, non si ricalcola.
  //
  // Prima la Home lo ricalcolava al volo sui sacchi dichiarati alla creazione
  // dell'ordine, mentre /admin/lavanderia leggeva `laundry_payouts`, scritto
  // alla consegna: due fonti per lo stesso numero, che non potevano coincidere.
  // Vince il registro, perché è l'unico verificabile riga per riga davanti alla
  // lavanderia — e perché il dovuto matura quando il lavoro è fatto, non quando
  // il cliente prenota.
  const [{ data: payouts }, { data: orders }] = await Promise.all([
    svc.from("laundry_payouts").select("amount_cents, created_at, status, orders(customer_id, profiles!orders_customer_id_fkey(is_test))").neq("status", "void").gte("created_at", yearStart)
      .returns<{ amount_cents: number; created_at: string; status: string; orders: { customer_id: string | null; profiles: { is_test: boolean } | null } | null }[]>(),
    svc.from("orders").select("bags, created_at, status, profiles!orders_customer_id_fkey(is_test)").neq("status", "cancelled").gte("created_at", yearStart)
      .returns<{ bags: number; created_at: string; status: string; profiles: { is_test: boolean } | null }[]>(),
  ]);

  let owedMonth = 0, owedYear = 0;
  for (const p of payouts ?? []) {
    if (!includiProva && p.orders?.profiles?.is_test) continue;
    owedYear += p.amount_cents ?? 0;
    if (p.created_at >= monthStart) owedMonth += p.amount_cents ?? 0;
  }

  // I sacchi restano un conteggio di volume, non di denaro: si contano dagli
  // ordini, perché dicono quanto lavoro è passato dalla lavanderia.
  let bagsMonth = 0, bagsYear = 0;
  for (const o of orders ?? []) {
    if (!includiProva && o.profiles?.is_test) continue;
    bagsYear += o.bags ?? 0;
    if (o.created_at >= monthStart) bagsMonth += o.bags ?? 0;
  }

  return { bagsMonth, bagsYear, laundryOwedMonthCents: owedMonth, laundryOwedYearCents: owedYear };
}

// ---------------- Abbonati (nuovi / interrotti / snapshot) ----------------

export type SubscriberMetrics = {
  newSubsMonth: number; newSubsYear: number;
  canceledMonth: number; canceledYear: number;
  currentActive: number; currentCanceled: number; currentPaused: number;
};

export async function subscriberMetrics(includiProva = false): Promise<SubscriberMetrics> {
  const svc = createServiceClient();
  const { monthStart, yearStart } = bounds();

  const { data: subs } = await svc
    .from("subscriptions")
    .select("user_id, status, created_at, activated_at, canceled_at, current_period_end, profiles(full_name, is_test)")
    .order("created_at", { ascending: false })
    .returns<{
      user_id: string; status: string; created_at: string; activated_at: string | null;
      canceled_at: string | null; current_period_end: string | null;
      profiles: { full_name: string | null; is_test: boolean } | null;
    }[]>();

  const righe = (subs ?? []).filter((s) => includiProva || !s.profiles?.is_test);

  let newSubsMonth = 0, newSubsYear = 0, canceledMonth = 0, canceledYear = 0;
  // Ultima riga per cliente: un cliente con due abbonamenti (uno creato a mano
  // e uno arrivato da Stripe) non deve contare due volte.
  const ultima = new Map<string, { status: string; current_period_end: string | null }>();
  for (const s of righe) {
    if (!ultima.has(s.user_id)) ultima.set(s.user_id, { status: s.status, current_period_end: s.current_period_end });
    if (s.activated_at && s.activated_at >= yearStart) { newSubsYear++; if (s.activated_at >= monthStart) newSubsMonth++; }
    if (s.canceled_at && s.canceled_at >= yearStart) { canceledYear++; if (s.canceled_at >= monthStart) canceledMonth++; }
  }

  let currentActive = 0, currentCanceled = 0, currentPaused = 0;
  for (const u of ultima.values()) {
    // Attivo vuol dire attivo adesso: uno stato "active" con il periodo finito
    // è un abbonamento morto che nessuno ha aggiornato.
    if (abbonamentoVivo(u)) currentActive++;
    else if (u.status === "paused") currentPaused++;
    else if (u.status === "canceled" || ACTIVE.includes(u.status)) currentCanceled++;
  }

  return { newSubsMonth, newSubsYear, canceledMonth, canceledYear, currentActive, currentCanceled, currentPaused };
}

// ---------------- Lead per stato & provenienza ----------------

export type DashboardLead = {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: "site" | "funnel" | "landing";
  status: string;      // stato grezzo per il filtro
  date: string | null; // ISO
  href: string | null; // link anagrafica (solo site)
  detail?: string | null; // riga extra (es. "CAP 20121 · Piano M · in zona")
};
export type LeadsResult = { leads: DashboardLead[]; leadError: string | null };

/** Lead = chi NON ha un abbonamento attivo. Sito = profili in DB (stato reale),
 *  Funnel = lead dal Google Sheet (stato sintetico "waitlist"),
 *  Disponibilità = tabella `leads`, dalla landing /disponibilita. */
export async function leadsByStatusSource(): Promise<LeadsResult> {
  const svc = createServiceClient();

  const [{ data: profs }, { data: subs }, wl, { data: landing }] = await Promise.all([
    svc.from("profiles").select("id, full_name, phone, created_at").eq("role", "customer").order("created_at", { ascending: false })
      .returns<{ id: string; full_name: string | null; phone: string | null; created_at: string }[]>(),
    svc.from("subscriptions").select("user_id, status, created_at").order("created_at", { ascending: false })
      .returns<{ user_id: string; status: string; created_at: string }[]>(),
    waitlistLeads(),
    svc.from("leads").select("id, full_name, email, phone, cap, plan, covered, created_at, contact_status").order("created_at", { ascending: false })
      .returns<{ id: string; full_name: string; email: string; phone: string | null; cap: string | null; plan: string | null; covered: boolean; created_at: string; contact_status: string }[]>(),
  ]);

  const latest = new Map<string, string>();
  for (const s of subs ?? []) if (!latest.has(s.user_id)) latest.set(s.user_id, s.status);

  // Email di TUTTI i profili in una sola listUsers paginata (prima erano N
  // getUserById, uno per cliente attivo). Serve a due cose: mostrare l'email
  // anche sui lead "sito", e deduplicare contro chiunque sia già in anagrafica —
  // non solo contro i clienti attivi.
  const emailById = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const u of users) {
      const e = u.email?.toLowerCase().trim();
      if (e) emailById.set(u.id, e);
    }
    if (users.length < 1000) break;
  }

  const leads: DashboardLead[] = [];
  for (const p of profs ?? []) {
    const status = latest.get(p.id) ?? "pending";
    if (ACTIVE.includes(status)) continue; // ha un abbonamento attivo → non è un lead
    leads.push({
      key: `site-${p.id}`,
      name: p.full_name ?? "—",
      phone: p.phone,
      email: emailById.get(p.id) ?? null,
      source: "site",
      status,
      date: p.created_at,
      href: `/admin/abbonati/${p.id}`,
    });
  }

  // Contatti di TUTTA l'anagrafica (non solo dei clienti attivi): chi è già un
  // profilo compare una volta sola, come lead "sito" o come cliente. Senza
  // questo, chi si registrava sul sito senza attivare l'abbonamento finiva
  // elencato due volte, una per provenienza.
  const knownEmails = new Set<string>();
  const knownPhones = new Set<string>();
  for (const p of profs ?? []) {
    const e = emailById.get(p.id);
    if (e) knownEmails.add(e);
    const n = normPhone(p.phone);
    if (n) knownPhones.add(n);
  }

  let leadError: string | null = null;
  if (wl.ok) {
    for (const l of wl.leads) {
      const emailKey = (l.email || "").toLowerCase().trim();
      const phoneKey = normPhone(l.phone);
      if ((emailKey && knownEmails.has(emailKey)) || (phoneKey && knownPhones.has(phoneKey))) continue; // già in anagrafica
      leads.push({
        key: `funnel-${l.id || l.email}-${l.dateLabel}`,
        name: l.name,
        phone: l.phone || null,
        email: l.email || null,
        source: "funnel",
        status: "waitlist",
        date: l.date,
        href: null,
      });
    }
  } else {
    leadError = wl.error;
  }

  // Lead dalla landing /disponibilita. Stessa regola del funnel: se sono già
  // in anagrafica compaiono lì, non qui.
  for (const l of landing ?? []) {
    const emailKey = l.email.toLowerCase().trim();
    const phoneKey = normPhone(l.phone);
    if (knownEmails.has(emailKey) || (phoneKey && knownPhones.has(phoneKey))) continue;
    leads.push({
      key: `landing-${l.id}`,
      name: l.full_name,
      phone: l.phone,
      email: l.email,
      source: "landing",
      // Lo stato vero della lavorazione, non più un'etichetta fissa: così il
      // filtro per stato in dashboard serve a qualcosa anche per questi lead.
      status: l.contact_status,
      date: l.created_at,
      href: null,
      detail: [l.cap ? `CAP ${l.cap}` : null, l.plan ? `Piano ${l.plan}` : null, l.covered ? "in zona" : "fuori zona"]
        .filter(Boolean)
        .join(" · "),
    });
  }

  // Più recenti in cima (le date nulle in fondo).
  leads.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
  return { leads, leadError };
}

// ---------------- Clienti (abbonati attivi) ----------------

export type DashboardCustomer = {
  id: string;
  name: string;
  phone: string | null;
  planName: string;
  status: string;
  since: string | null; // ISO (attivazione)
  href: string;
};

/** Elenco clienti = abbonati con abbonamento attivo/in prova (ultima sub). */
export async function customersList(includiProva = false): Promise<DashboardCustomer[]> {
  const svc = createServiceClient();

  const { data: subs } = await svc
    .from("subscriptions")
    .select("user_id, status, created_at, activated_at, custom_price_cents, current_period_end, plans(name), profiles(is_test)")
    .order("created_at", { ascending: false })
    .returns<{ user_id: string; status: string; created_at: string; activated_at: string | null; custom_price_cents: number | null; current_period_end: string | null; plans: { name: string } | null; profiles: { is_test: boolean } | null }[]>();

  type Sub = NonNullable<typeof subs>[number];
  const latest = new Map<string, Sub>();
  for (const s of subs ?? []) {
    if (!includiProva && s.profiles?.is_test) continue;
    if (!latest.has(s.user_id)) latest.set(s.user_id, s);
  }
  // Stesso criterio del ricorrente: attivo vuol dire anche periodo non scaduto.
  const active = [...latest.values()].filter((s) => abbonamentoVivo(s));
  if (active.length === 0) return [];

  const ids = active.map((s) => s.user_id);
  const { data: profs } = await svc.from("profiles").select("id, full_name, phone").in("id", ids)
    .returns<{ id: string; full_name: string | null; phone: string | null }[]>();
  const pmap = new Map((profs ?? []).map((p) => [p.id, p]));

  return active
    .map((s) => ({
      id: s.user_id,
      name: pmap.get(s.user_id)?.full_name ?? "—",
      phone: pmap.get(s.user_id)?.phone ?? null,
      planName: s.plans?.name ?? (s.custom_price_cents != null ? "Personalizzato" : "—"),
      status: s.status,
      since: s.activated_at ?? s.created_at,
      href: `/admin/abbonati/${s.user_id}`,
    }))
    .sort((a, b) => (b.since ? Date.parse(b.since) : 0) - (a.since ? Date.parse(a.since) : 0));
}
