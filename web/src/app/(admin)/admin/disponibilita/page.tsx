import { Card, PageTitle } from "@/components/app/AppShell";
import { createServiceClient } from "@/lib/supabase/server";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { LeadActions } from "@/components/admin/LeadActions";
import { CONTACT_STATUS, CONTACT_STATUS_LABEL, isContactStatus, type ContactStatus } from "@/lib/lead-status";

/** Admin → Disponibilità: le richieste raccolte dalla landing /disponibilita.
 *  Fonte diretta: tabella `leads` su Supabase. Ricerca con ?q=, filtro copertura
 *  con ?zona=in|fuori, export CSV via /admin/disponibilita/export. */

export type AdminLead = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cap: string | null;
  plan: string | null;
  covered: boolean;
  contact_status: string;
  created_at: string;
  utm: { source?: string | null; medium?: string | null; campaign?: string | null } | null;
  zones: { name: string } | null;
};

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default async function DisponibilitaAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; zona?: string; stato?: string; ok?: string; warn?: string }>;
}) {
  const { q, zona, stato, ok, warn } = await searchParams;
  const needle = (q ?? "").trim().toLowerCase();

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("leads")
    .select("id, full_name, email, phone, cap, plan, covered, contact_status, created_at, utm, zones(name)")
    .order("created_at", { ascending: false })
    .returns<AdminLead[]>();

  const all = data ?? [];
  const leads = all.filter((l) => {
    if (zona === "in" && !l.covered) return false;
    if (zona === "fuori" && l.covered) return false;
    if (stato && l.contact_status !== stato) return false;
    if (!needle) return true;
    return `${l.full_name} ${l.email} ${l.phone ?? ""} ${l.cap ?? ""} ${l.zones?.name ?? ""}`.toLowerCase().includes(needle);
  });

  const inZona = all.filter((l) => l.covered).length;
  const daContattare = all.filter((l) => l.contact_status === "da_contattare").length;
  const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";
  const pill = (active: boolean) =>
    `rounded-full px-4 py-2 font-display text-sm font-bold ${active ? "bg-navy text-white" : "border border-line text-navy"}`;

  // I filtri attivi valgono anche per l'export: scarichi quello che vedi.
  const exportQs = new URLSearchParams();
  if (q) exportQs.set("q", q);
  if (zona) exportQs.set("zona", zona);
  if (stato) exportQs.set("stato", stato);
  const exportHref = `/admin/disponibilita/export${exportQs.toString() ? `?${exportQs}` : ""}`;

  return (
    <>
      <PageTitle
        kicker="Disponibilità"
        title="Richieste dalla landing"
        sub={`${all.length} richieste · ${inZona} in zona · ${daContattare} da contattare`}
      />

      {ok && <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-2">
          <label className="min-w-[240px] flex-1 text-xs font-bold text-muted">
            Cerca per nome, email, telefono, CAP o zona
            <input name="q" defaultValue={q ?? ""} placeholder="mario, mario@email.it, 20143…" className={`${input} mt-1`} />
          </label>
          <label className="text-xs font-bold text-muted">
            Copertura
            <select name="zona" defaultValue={zona ?? ""} className={`${input} mt-1 cursor-pointer`}>
              <option value="">Tutte</option>
              <option value="in">Solo in zona</option>
              <option value="fuori">Solo fuori zona</option>
            </select>
          </label>
          <label className="text-xs font-bold text-muted">
            Stato contatto
            <select name="stato" defaultValue={stato ?? ""} className={`${input} mt-1 cursor-pointer`}>
              <option value="">Tutti</option>
              {CONTACT_STATUS.map((s) => (<option key={s} value={s}>{CONTACT_STATUS_LABEL[s]}</option>))}
            </select>
          </label>
          <button type="submit" className="rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-2 font-display text-sm font-extrabold text-white">Cerca</button>
          {(q || zona || stato) && <a href="/admin/disponibilita" className={pill(false)}>Pulisci</a>}
          <a href={exportHref} className="rounded-full border-2 border-navy/25 px-5 py-2 font-display text-sm font-extrabold text-navy hover:bg-navy/5">
            ⬇ Scarica CSV ({leads.length})
          </a>
        </form>
      </Card>

      {error ? (
        <Card><p className="text-sm font-semibold text-[#C0392B]">Impossibile leggere le richieste: {error.message}</p></Card>
      ) : leads.length === 0 ? (
        <Card><p className="text-sm font-medium text-muted">Nessuna richiesta{needle ? ` per «${q}»` : ""}.</p></Card>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <Card key={l.id} className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-display text-sm font-extrabold text-navy">{l.full_name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-medium text-muted">
                    <a href={`mailto:${l.email}`} className="text-blue hover:underline">{l.email}</a>
                    {l.phone && <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="text-blue hover:underline">{l.phone}</a>}
                    {l.cap && <span>CAP {l.cap}</span>}
                    {l.zones?.name && <span>{l.zones.name}</span>}
                    {l.plan && <span>Piano {l.plan}</span>}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-2 text-xs font-medium text-muted">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 font-display text-[11px] font-bold ${l.covered ? "bg-[#1F8A5B]/15 text-[#1F8A5B]" : "bg-[#C9881F]/15 text-[#C9881F]"}`}>
                      {l.covered ? "In zona" : "Fuori zona"}
                    </span>
                    <span>{fmt(l.created_at)}</span>
                  </div>
                  <LeadStatusSelect
                    leadId={l.id}
                    value={(isContactStatus(l.contact_status) ? l.contact_status : "da_contattare") as ContactStatus}
                    back="/admin/disponibilita"
                  />
                  <LeadActions leadId={l.id} name={l.full_name} back="/admin/disponibilita" />
                </div>
              </div>
              {(l.utm?.source || l.utm?.medium || l.utm?.campaign) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {([["source", l.utm?.source], ["medium", l.utm?.medium], ["campaign", l.utm?.campaign]] as const)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <span key={k} className="inline-flex rounded-full bg-ice px-2.5 py-1 text-xs font-medium text-navy">
                        <span className="font-bold text-muted">utm_{k}:</span>&nbsp;{v}
                      </span>
                    ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs font-medium text-muted">
        Il CSV si apre in Google Sheets con File → Importa → Carica.
      </p>
    </>
  );
}
