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
  source: "site" | "funnel";
  status: string;      // stato grezzo per il filtro
  date: string | null; // ISO
  href: string | null; // link anagrafica (solo site)
};
export type LeadsResult = { leads: DashboardLead[]; leadError: string | null };

/** Lead = chi NON ha un abbonamento attivo. Sito = profili in DB (stato reale),
 *  Funnel = lead dal Google Sheet (stato sintetico "waitlist"). */
export async function leadsByStatusSource(): Promise<LeadsResult> {
  const svc = createServiceClient();

  const [{ data: profs }, { data: subs }, wl] = await Promise.all([
    svc.from("profiles").select("id, full_name, phone, created_at").eq("role", "customer").order("created_at", { ascending: false })
      .returns<{ id: string; full_name: string | null; phone: string | null; created_at: string }[]>(),
    svc.from("subscriptions").select("user_id, status, created_at").order("created_at", { ascending: false })
      .returns<{ user_id: string; status: string; created_at: string }[]>(),
    waitlistLeads(),
  ]);

  const latest = new Map<string, string>();
  for (const s of subs ?? []) if (!latest.has(s.user_id)) latest.set(s.user_id, s.status);

  const leads: DashboardLead[] = [];
  for (const p of profs ?? []) {
    const status = latest.get(p.id) ?? "pending";
    if (ACTIVE.includes(status)) continue; // ha un abbonamento attivo → non è un lead
    leads.push({
      key: `site-${p.id}`,
      name: p.full_name ?? "—",
      phone: p.phone,
      email: null,
      source: "site",
      status,
      date: p.created_at,
      href: `/admin/abbonati/${p.id}`,
    });
  }

  let leadError: string | null = null;
  if (wl.ok) {
    for (const l of wl.leads) {
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

  // Più recenti in cima (le date nulle in fondo).
  leads.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
  return { leads, leadError };
}
