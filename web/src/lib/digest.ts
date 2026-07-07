import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMail, renderEmail } from "@/lib/email";
import { waitlistLeads } from "@/lib/waitlist";

/** Digest "novità": nuovi clienti registrati + nuovi lead dal funnel, in una
 *  finestra temporale. Usato dal cron giornaliero (email agli admin) e dalla
 *  dashboard admin /admin/novita. */

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it").replace(/\s+/g, "");

const SUB_LABEL: Record<string, string> = {
  active: "Attivo", trialing: "In prova", past_due: "Pagamento sospeso",
  unpaid: "Non pagato", canceled: "Disdetto", paused: "In pausa",
  incomplete: "Da attivare", pending: "Pending (lead)",
};

export type DigestCustomer = { id: string; name: string; email: string | null; phone: string | null; status: string; created_at: string };
export type DigestLead = { name: string; email: string; phone: string; address: string; dateLabel: string };
export type DigestData = { sinceIso: string; hours: number; newCustomers: DigestCustomer[]; newLeads: DigestLead[]; leadError: string | null };

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

  return { sinceIso, hours, newCustomers, newLeads, leadError };
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

  const table = (title: string, headers: string[], rows: string, empty: string) => `
    <div style="margin:18px 0 6px;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:800;color:#0B1F3A">${title}</div>
    ${rows
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E1E8F1;border-radius:10px;border-collapse:separate;overflow:hidden">
           <tr style="background:#F4F7FB">${headers.map((h) => `<th align="left" style="padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#8597AB">${h}</th>`).join("")}</tr>
           ${rows}
         </table>`
      : `<div style="font-size:13px;color:#8597AB">${empty}</div>`}`;

  const body = `
    Riepilogo delle ultime ${d.hours} ore.<br/>
    <strong>${d.newCustomers.length}</strong> nuovi clienti · <strong>${d.newLeads.length}</strong> nuovi lead dal funnel.
    ${table("👤 Nuovi clienti", ["Nome", "Contatti", "Stato"], cRows, "Nessun nuovo cliente.")}
    ${table("🌱 Nuovi lead (funnel)", ["Nome", "Contatti", "Indirizzo"], lRows, d.leadError ? `Lista d'attesa non raggiungibile: ${esc(d.leadError)}` : "Nessun nuovo lead.")}
  `;

  return renderEmail({
    title: "Novità di oggi",
    body,
    emoji: "📈",
    preheader: `${d.newCustomers.length} clienti · ${d.newLeads.length} lead nelle ultime ${d.hours}h`,
    cta: { label: "Apri la dashboard", href: `${site()}/admin/novita` },
  });
}

/** Invia il digest agli admin se c'è almeno una novità. Ritorna l'esito. */
export async function sendDailyDigest(hours = 24): Promise<{ sent: boolean; customers: number; leads: number; recipients: number; reason?: string }> {
  const data = await gatherDigest(hours);
  const total = data.newCustomers.length + data.newLeads.length;
  if (total === 0) return { sent: false, customers: 0, leads: 0, recipients: 0, reason: "nessuna novità" };

  const to = await digestRecipients();
  if (to.length === 0) return { sent: false, customers: data.newCustomers.length, leads: data.newLeads.length, recipients: 0, reason: "nessun destinatario admin" };

  await sendMail({
    to: to.join(","),
    subject: `WashLoop · ${data.newCustomers.length} nuovi clienti, ${data.newLeads.length} nuovi lead (${hours}h)`,
    html: digestEmailHtml(data),
  });
  return { sent: true, customers: data.newCustomers.length, leads: data.newLeads.length, recipients: to.length };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
