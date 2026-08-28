import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMail, renderEmail } from "@/lib/email";
import { waitlistLeads } from "@/lib/waitlist";
import { guastiRecenti, type Guasto } from "@/lib/incidenti";

/** Digest "novità": nuovi clienti registrati + nuovi lead dal funnel, in una
 *  finestra temporale. Usato dal cron giornaliero (email agli admin) e dalla
 *  dashboard admin (/admin). */

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it").replace(/\s+/g, "");

const SUB_LABEL: Record<string, string> = {
  active: "Attivo", trialing: "In prova", past_due: "Pagamento sospeso",
  unpaid: "Non pagato", canceled: "Disdetto", paused: "In pausa",
  incomplete: "Da attivare", pending: "Pending (lead)",
};

export type DigestCustomer = { id: string; name: string; email: string | null; phone: string | null; status: string; created_at: string };
export type DigestLead = { name: string; email: string; phone: string; address: string; dateLabel: string };
export type DigestLandingLead = { name: string; email: string; phone: string; cap: string; plan: string; covered: boolean; created_at: string };
export type DigestData = {
  sinceIso: string;
  hours: number;
  newCustomers: DigestCustomer[];
  newLeads: DigestLead[];
  newLandingLeads: DigestLandingLead[];
  leadError: string | null;
  /** Guasti registrati nella finestra: email non partite, cron falliti, webhook rifiutati. */
  guasti: Guasto[];
  /** Segni di vita. Servono a rendere visibile il silenzio: il caso che ci è
   *  costato un mese non produceva errori, semplicemente non arrivava niente. */
  battito: { eventiStripe: number; incassi: number; ordini: number };
};

/** Raccoglie clienti e lead comparsi nelle ultime `hours` ore. */
export async function gatherDigest(hours = 24): Promise<DigestData> {
  const svc = createServiceClient();
  const sinceIso = new Date(Date.now() - hours * 3600_000).toISOString();

  // Nuovi clienti registrati (profili role=customer creati nella finestra).
  const { data: profs } = await svc
    .from("profiles")
    .select("id, full_name, phone, created_at")
    .eq("role", "customer")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .returns<{ id: string; full_name: string | null; phone: string | null; created_at: string }[]>();

  const newCustomers: DigestCustomer[] = [];
  for (const p of profs ?? []) {
    const [{ data: au }, { data: sub }] = await Promise.all([
      svc.auth.admin.getUserById(p.id),
      svc.from("subscriptions").select("status").eq("user_id", p.id).order("created_at", { ascending: false }).limit(1).maybeSingle<{ status: string }>(),
    ]);
    newCustomers.push({
      id: p.id,
      name: p.full_name ?? "—",
      email: au?.user?.email ?? null,
      phone: p.phone,
      status: sub?.status ?? "pending",
      created_at: p.created_at,
    });
  }

  // Nuovi lead dal funnel (Google Sheet). Best-effort: se il foglio non risponde,
  // il digest esce comunque con i soli clienti.
  let newLeads: DigestLead[] = [];
  let leadError: string | null = null;
  const wl = await waitlistLeads();
  if (wl.ok) {
    const cutoff = Date.now() - hours * 3600_000;
    newLeads = wl.leads
      .filter((l) => l.date && Date.parse(l.date) >= cutoff)
      .map((l) => ({ name: l.name, email: l.email, phone: l.phone, address: l.address, dateLabel: l.dateLabel }));
  } else {
    leadError = wl.error;
  }

  // Nuove richieste dalla landing /disponibilita (tabella `leads`).
  const { data: landing } = await svc
    .from("leads")
    .select("full_name, email, phone, cap, plan, covered, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .returns<{ full_name: string; email: string; phone: string | null; cap: string | null; plan: string | null; covered: boolean; created_at: string }[]>();

  const newLandingLeads: DigestLandingLead[] = (landing ?? []).map((l) => ({
    name: l.full_name,
    email: l.email,
    phone: l.phone ?? "",
    cap: l.cap ?? "",
    plan: l.plan ?? "",
    covered: l.covered,
    created_at: l.created_at,
  }));

  // Guasti e segni di vita, raccolti insieme al resto.
  const [guasti, eventiStripe, incassi, ordini] = await Promise.all([
    guastiRecenti(hours),
    svc.from("stripe_events").select("id", { count: "exact", head: true }).gte("received_at", sinceIso),
    svc.from("invoices").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
    svc.from("orders").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
  ]);

  return {
    sinceIso,
    hours,
    newCustomers,
    newLeads,
    newLandingLeads,
    leadError,
    guasti,
    battito: { eventiStripe: eventiStripe.count ?? 0, incassi: incassi.count ?? 0, ordini: ordini.count ?? 0 },
  };
}

/** Email di tutti gli admin (+ eventuali destinatari extra da env DIGEST_RECIPIENTS). */
export async function digestRecipients(): Promise<string[]> {
  const svc = createServiceClient();
  const { data: admins } = await svc.from("profiles").select("id").eq("role", "admin").returns<{ id: string }[]>();
  const out: string[] = [];
  for (const a of admins ?? []) {
    const { data } = await svc.auth.admin.getUserById(a.id);
    if (data?.user?.email) out.push(data.user.email);
  }
  const extra = (process.env.DIGEST_RECIPIENTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set([...out, ...extra]));
}

function digestEmailHtml(d: DigestData): string {
  const cRows = d.newCustomers.map((c) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:14px;color:#0B1F3A"><strong>${esc(c.name)}</strong></td>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:13px;color:#46586E">${esc(c.email ?? "—")}${c.phone ? `<br/>${esc(c.phone)}` : ""}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:13px;color:#46586E">${esc(SUB_LABEL[c.status] ?? c.status)}</td>
    </tr>`).join("");

  const lRows = d.newLeads.map((l) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:14px;color:#0B1F3A"><strong>${esc(l.name)}</strong></td>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:13px;color:#46586E">${esc(l.email || "—")}${l.phone ? `<br/>${esc(l.phone)}` : ""}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:13px;color:#46586E">${esc(l.address || "—")}</td>
    </tr>`).join("");

  const dRows = d.newLandingLeads.map((l) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:14px;color:#0B1F3A"><strong>${esc(l.name)}</strong></td>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:13px;color:#46586E">${esc(l.email)}${l.phone ? `<br/>${esc(l.phone)}` : ""}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:13px;color:#46586E">${esc(l.cap || "—")}${l.plan ? ` · Piano ${esc(l.plan)}` : ""}<br/>${l.covered ? "in zona" : "fuori zona"}</td>
    </tr>`).join("");

  const table = (title: string, headers: string[], rows: string, empty: string) => `
    <div style="margin:18px 0 6px;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:800;color:#0B1F3A">${title}</div>
    ${rows
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E1E8F1;border-radius:10px;border-collapse:separate;overflow:hidden">
           <tr style="background:#F4F7FB">${headers.map((h) => `<th align="left" style="padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#8597AB">${h}</th>`).join("")}</tr>
           ${rows}
         </table>`
      : `<div style="font-size:13px;color:#8597AB">${empty}</div>`}`;

  const gRows = d.guasti.map((g) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:13px;color:#46586E">${esc(g.area)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:14px;color:#0B1F3A">${esc(g.messaggio)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E1E8F1;font-size:13px;color:#46586E">${g.quante}&times;</td>
    </tr>`).join("");

  // Il riquadro dei guasti sta IN CIMA quando c'è: è l'unica parte per cui vale
  // la pena aprire l'email di corsa.
  const allarme = d.guasti.length
    ? `<div style="margin:0 0 16px;padding:12px 14px;border-radius:10px;background:#FBECEA;border:1px solid #E4B4AE">
         <div style="font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:800;color:#C0392B">⚠️ ${d.guasti.length === 1 ? "1 guasto" : `${d.guasti.length} guasti`} nelle ultime ${d.hours} ore</div>
         <div style="font-size:13px;color:#8A4B42;margin-top:2px">Roba che non ha funzionato e che nessuno ha visto: email non partite, cron falliti, webhook rifiutati.</div>
       </div>`
    : "";

  const body = `
    ${allarme}
    Riepilogo delle ultime ${d.hours} ore.<br/>
    <strong>${d.newCustomers.length}</strong> nuovi clienti · <strong>${d.newLeads.length}</strong> lead dal funnel · <strong>${d.newLandingLeads.length}</strong> richieste di disponibilità.
    ${table("👤 Nuovi clienti", ["Nome", "Contatti", "Stato"], cRows, "Nessun nuovo cliente.")}
    ${table("🌱 Nuovi lead (funnel)", ["Nome", "Contatti", "Indirizzo"], lRows, d.leadError ? `Lista d'attesa non raggiungibile: ${esc(d.leadError)}` : "Nessun nuovo lead.")}
    ${table("📍 Richieste disponibilità (landing)", ["Nome", "Contatti", "Zona"], dRows, "Nessuna nuova richiesta.")}
    ${table("⚠️ Guasti", ["Dove", "Cosa", "Volte"], gRows, "Nessun guasto registrato. ")}
    <div style="margin:18px 0 6px;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:800;color:#0B1F3A">💓 Segni di vita</div>
    <div style="font-size:13px;color:#46586E;line-height:1.7">
      Messaggi ricevuti da Stripe: <strong>${d.battito.eventiStripe}</strong> ·
      incassi registrati: <strong>${d.battito.incassi}</strong> ·
      ordini creati: <strong>${d.battito.ordini}</strong>
      <div style="color:#8597AB;margin-top:4px">Sono numeri che di norma non stanno a zero tutti insieme. Se ci restano per giorni, qualcosa si è staccato senza dare errore — è così che per un mese non è arrivato un solo pagamento da Stripe.</div>
    </div>
  `;

  return renderEmail({
    title: "Novità di oggi",
    body,
    emoji: "📈",
    preheader: `${d.newCustomers.length} clienti · ${d.newLeads.length + d.newLandingLeads.length} lead nelle ultime ${d.hours}h`,
    cta: { label: "Apri la dashboard", href: `${site()}/admin` },
  });
}

/** Invia il digest agli admin se c'è almeno una novità. Ritorna l'esito. */
export async function sendDailyDigest(hours = 24): Promise<{ sent: boolean; customers: number; leads: number; recipients: number; reason?: string }> {
  const data = await gatherDigest(hours);
  // I lead della landing contano nel totale: senza, un giorno con sole richieste
  // di disponibilità non farebbe partire nessun digest.
  const leadCount = data.newLeads.length + data.newLandingLeads.length;
  const total = data.newCustomers.length + leadCount;
  // Un guasto è una novità: in una giornata senza clienti né lead, prima il
  // digest non partiva ed era proprio il giorno in cui serviva di più.
  if (total === 0 && data.guasti.length === 0) {
    return { sent: false, customers: 0, leads: 0, recipients: 0, reason: "nessuna novità" };
  }

  const to = await digestRecipients();
  if (to.length === 0) return { sent: false, customers: data.newCustomers.length, leads: leadCount, recipients: 0, reason: "nessun destinatario admin" };

  await sendMail({
    to: to.join(","),
    subject: data.guasti.length
      ? `WashLoop · ⚠️ ${data.guasti.length} da controllare · ${data.newCustomers.length} clienti, ${leadCount} lead (${hours}h)`
      : `WashLoop · ${data.newCustomers.length} nuovi clienti, ${leadCount} nuovi lead (${hours}h)`,
    html: digestEmailHtml(data),
  });
  return { sent: true, customers: data.newCustomers.length, leads: leadCount, recipients: to.length };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
