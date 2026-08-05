import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { waitlistLeads } from "@/lib/waitlist";

/** Aggregatori per la dashboard admin. Tutti gli importi sono in cent EUR.
 *  Le finestre mese/anno usano i confini locali (Europe/Rome, approssimati
 *  all'UTC della data di Roma: scarto max ~2h ai bordi, irrilevante). */

const BAG_COMP_DEFAULT = 800; // €8,00 per sacco se la lavanderia non ha un compenso proprio

function bounds() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m] = parts.split("-").map(Number);
  return {
    monthStart: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    yearStart: new Date(Date.UTC(y, 0, 1)).toISOString(),
  };
}

const ACTIVE = ["active", "trialing"];

/** Normalizza un telefono a sole cifre (ultime 10) per confronti robusti. */
function normPhone(p: string | null | undefined): string {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

// ---------------- Ricavi (Core MRR + Extra) ----------------

export type RevenueMetrics = { coreMrrCents: number; coreYearProjCents: number; extraMonthCents: number; extraYearCents: number };

export async function revenueMetrics(): Promise<RevenueMetrics> {
  const svc = createServiceClient();
  const { monthStart, yearStart } = bounds();

  const [{ data: subs }, { data: specials }, { data: charges }] = await Promise.all([
    svc.from("subscriptions").select("custom_price_cents, plans(price_month_cents)").in("status", ACTIVE)
      .returns<{ custom_price_cents: number | null; plans: { price_month_cents: number } | null }[]>(),
    svc.from("order_specials").select("price_cli_cents, qty, created_at").is("refunded_at", null).gte("created_at", yearStart)
      .returns<{ price_cli_cents: number; qty: number; created_at: string }[]>(),
    svc.from("customer_charges").select("amount_cents, kind, created_at").neq("status", "void").gte("created_at", yearStart)
      .returns<{ amount_cents: number; kind: string; created_at: string }[]>(),
  ]);

  const coreMrrCents = (subs ?? []).reduce((s, r) => s + (r.custom_price_cents ?? r.plans?.price_month_cents ?? 0), 0);

  let extraMonthCents = 0, extraYearCents = 0;
  for (const x of specials ?? []) {
    const v = (x.price_cli_cents ?? 0) * (x.qty ?? 1);
    extraYearCents += v;
    if (x.created_at >= monthStart) extraMonthCents += v;
  }
  for (const c of charges ?? []) {
    const v = (c.kind === "refund" ? -1 : 1) * (c.amount_cents ?? 0);
    extraYearCents += v;
    if (c.created_at >= monthStart) extraMonthCents += v;
  }

  return { coreMrrCents, coreYearProjCents: coreMrrCents * 12, extraMonthCents, extraYearCents };
}

// ---------------- Lavanderia (sacchi + compenso dovuto) ----------------

export type LaundryMetrics = { bagsMonth: number; bagsYear: number; laundryOwedMonthCents: number; laundryOwedYearCents: number };

export async function laundryMetrics(): Promise<LaundryMetrics> {
  const svc = createServiceClient();
  const { monthStart, yearStart } = bounds();

  const [{ data: orders }, { data: laundries }, { data: specials }] = await Promise.all([
    svc.from("orders").select("bags, laundry_id, created_at").neq("status", "cancelled").gte("created_at", yearStart)
      .returns<{ bags: number; laundry_id: string | null; created_at: string }[]>(),
    svc.from("laundries").select("id, bag_comp_cents").returns<{ id: string; bag_comp_cents: number }[]>(),
    svc.from("order_specials").select("comp_lav_cents, qty, created_at").is("refunded_at", null).gte("created_at", yearStart)
      .returns<{ comp_lav_cents: number; qty: number; created_at: string }[]>(),
  ]);

  const compOf = new Map((laundries ?? []).map((l) => [l.id, l.bag_comp_cents ?? BAG_COMP_DEFAULT]));

  let bagsMonth = 0, bagsYear = 0, owedMonth = 0, owedYear = 0;
  for (const o of orders ?? []) {
    const bags = o.bags ?? 0;
    const comp = (o.laundry_id && compOf.get(o.laundry_id)) || BAG_COMP_DEFAULT;
    bagsYear += bags; owedYear += bags * comp;
    if (o.created_at >= monthStart) { bagsMonth += bags; owedMonth += bags * comp; }
  }
  for (const x of specials ?? []) {
    const v = (x.comp_lav_cents ?? 0) * (x.qty ?? 1);
    owedYear += v;
    if (x.created_at >= monthStart) owedMonth += v;
  }

  return { bagsMonth, bagsYear, laundryOwedMonthCents: owedMonth, laundryOwedYearCents: owedYear };
}

// ---------------- Abbonati (nuovi / interrotti / snapshot) ----------------

export type SubscriberMetrics = {
  newSubsMonth: number; newSubsYear: number;
  canceledMonth: number; canceledYear: number;
  currentActive: number; currentCanceled: number; currentPaused: number;
};

export async function subscriberMetrics(): Promise<SubscriberMetrics> {
  const svc = createServiceClient();
  const { monthStart, yearStart } = bounds();

  const { data: subs } = await svc
    .from("subscriptions")
    .select("user_id, status, created_at, activated_at, canceled_at")
    .order("created_at", { ascending: false })
    .returns<{ user_id: string; status: string; created_at: string; activated_at: string | null; canceled_at: string | null }[]>();

  let newSubsMonth = 0, newSubsYear = 0, canceledMonth = 0, canceledYear = 0;
  const latest = new Map<string, string>(); // user_id → status (ultima sub)
  for (const s of subs ?? []) {
    if (!latest.has(s.user_id)) latest.set(s.user_id, s.status);
    if (s.activated_at && s.activated_at >= yearStart) { newSubsYear++; if (s.activated_at >= monthStart) newSubsMonth++; }
    if (s.canceled_at && s.canceled_at >= yearStart) { canceledYear++; if (s.canceled_at >= monthStart) canceledMonth++; }
  }

  let currentActive = 0, currentCanceled = 0, currentPaused = 0;
  for (const st of latest.values()) {
    if (ACTIVE.includes(st)) currentActive++;
    else if (st === "canceled") currentCanceled++;
    else if (st === "paused") currentPaused++;
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
    svc.from("leads").select("id, full_name, email, phone, cap, plan, covered, created_at").order("created_at", { ascending: false })
      .returns<{ id: string; full_name: string; email: string; phone: string | null; cap: string | null; plan: string | null; covered: boolean; created_at: string }[]>(),
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
      status: "landing",
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
export async function customersList(): Promise<DashboardCustomer[]> {
  const svc = createServiceClient();

  const { data: subs } = await svc
    .from("subscriptions")
    .select("user_id, status, created_at, activated_at, custom_price_cents, plans(name)")
    .order("created_at", { ascending: false })
    .returns<{ user_id: string; status: string; created_at: string; activated_at: string | null; custom_price_cents: number | null; plans: { name: string } | null }[]>();

  type Sub = NonNullable<typeof subs>[number];
  const latest = new Map<string, Sub>();
  for (const s of subs ?? []) if (!latest.has(s.user_id)) latest.set(s.user_id, s);
  const active = [...latest.values()].filter((s) => ACTIVE.includes(s.status));
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
