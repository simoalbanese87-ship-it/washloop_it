import { Card, PageTitle } from "@/components/app/AppShell";
import { createServiceClient } from "@/lib/supabase/server";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { LeadActions } from "@/components/admin/LeadActions";
import { CONTACT_STATUS, CONTACT_STATUS_LABEL, isContactStatus, type ContactStatus } from "@/lib/lead-status";

/** Admin → Contatti: TUTTI i potenziali clienti in un elenco solo.
 *
 *  Prima la stessa persona compariva in quattro pagine — Dashboard, Novità,
 *  Lista d'attesa e Disponibilità — alimentate da archivi diversi, e chi
 *  compilava sia il funnel sia la landing risultava due volte perché nessuno
 *  incrociava i due bacini. Ora la fonte è una sola (`leads`), i lead del
 *  funnel ci arrivano con l'import notturno, e le vecchie pagine reindirizzano
 *  qui con il filtro giusto: nessun link salvato si rompe.
 *
 *  Tutto è filtro, niente è una pagina a sé: `?fonte=`, `?stato=`, `?zona=`,
 *  `?nuovi=7g`, `?q=`. */

export const dynamic = "force-dynamic";

type Contatto = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cap: string | null;
  plan: string | null;
  covered: boolean;
  contact_status: string;
  source: string | null;
  notes: string | null;
  created_at: string;
  utm: { source?: string | null; medium?: string | null; campaign?: string | null } | null;
  zones: { name: string } | null;
};

const FONTE_LABEL: Record<string, string> = { landing: "Landing", funnel: "Funnel", manuale: "Inserito a mano" };

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default async function ContattiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; zona?: string; stato?: string; fonte?: string; nuovi?: string; ok?: string; warn?: string }>;
}) {
  const { q, zona, stato, fonte, nuovi, ok, warn } = await searchParams;
  const needle = (q ?? "").trim().toLowerCase();

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("leads")
    .select("id, full_name, email, phone, cap, plan, covered, contact_status, source, notes, created_at, utm, zones(name)")
    .order("created_at", { ascending: false })
    .returns<Contatto[]>();

  const all = data ?? [];
  // `new Date()` e non `Date.now()`: la regola di purezza di React segnala la
  // seconda anche nei componenti server, dove il calcolo è per richiesta.
  const settimanaFa = new Date(new Date().setDate(new Date().getDate() - 7)).getTime();

  const lista = all.filter((l) => {
    if (zona === "in" && !l.covered) return false;
    if (zona === "fuori" && l.covered) return false;
    if (stato && l.contact_status !== stato) return false;
    if (fonte && (l.source ?? "landing") !== fonte) return false;
    if (nuovi === "7g" && Date.parse(l.created_at) < settimanaFa) return false;
    if (!needle) return true;
    return `${l.full_name} ${l.email} ${l.phone ?? ""} ${l.cap ?? ""} ${l.zones?.name ?? ""}`.toLowerCase().includes(needle);
  });

  const inZona = all.filter((l) => l.covered).length;
  const daContattare = all.filter((l) => l.contact_status === "da_contattare").length;
  const ultimi7 = all.filter((l) => Date.parse(l.created_at) >= settimanaFa).length;

  const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";
  const pill = (active: boolean) =>
    `rounded-full px-4 py-2 font-display text-sm font-bold ${active ? "bg-navy text-white" : "border border-line text-navy"}`;

  // I filtri attivi valgono anche per l'export: scarichi quello che vedi.
  const exportQs = new URLSearchParams();
  for (const [k, v] of Object.entries({ q, zona, stato, fonte, nuovi })) if (v) exportQs.set(k, v);
  const exportHref = `/admin/contatti/export${exportQs.toString() ? `?${exportQs}` : ""}`;

  return (
    <>
      <PageTitle
        kicker="Contatti"
        title="Tutti i potenziali clienti"
        sub={`${all.length} contatti · ${inZona} in zona · ${daContattare} da contattare · ${ultimi7} negli ultimi 7 giorni`}
      />

      {ok && <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 text-xs font-bold text-muted">
            Cerca per nome, email, telefono, CAP o zona
            <input name="q" defaultValue={q ?? ""} placeholder="mario, mario@email.it, 20143…" className={`${input} mt-1`} />
          </label>
          <label className="text-xs font-bold text-muted">
            Provenienza
            <select name="fonte" defaultValue={fonte ?? ""} className={`${input} mt-1 cursor-pointer`}>
              <option value="">Tutte</option>
              <option value="landing">Landing</option>
              <option value="funnel">Funnel</option>
            </select>
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
          <label className="text-xs font-bold text-muted">
            Periodo
            <select name="nuovi" defaultValue={nuovi ?? ""} className={`${input} mt-1 cursor-pointer`}>
              <option value="">Sempre</option>
              <option value="7g">Ultimi 7 giorni</option>
            </select>
          </label>
          <button type="submit" className="rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-2 font-display text-sm font-extrabold text-white">Cerca</button>
          {(q || zona || stato || fonte || nuovi) && <a href="/admin/contatti" className={pill(false)}>Pulisci</a>}
          <a href={exportHref} className="rounded-full border-2 border-navy/25 px-5 py-2 font-display text-sm font-extrabold text-navy hover:bg-navy/5">
            ⬇ Scarica CSV ({lista.length})
          </a>
        </form>
      </Card>

      {error ? (
        <Card><p className="text-sm font-semibold text-[#C0392B]">Impossibile leggere i contatti: {error.message}</p></Card>
      ) : lista.length === 0 ? (
        <Card><p className="text-sm font-medium text-muted">Nessun contatto{needle ? ` per «${q}»` : ""}.</p></Card>
      ) : (
        <div className="space-y-3">
          {lista.map((l) => (
            <Card key={l.id} className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-extrabold text-navy">{l.full_name}</span>
                    <span className="rounded-full bg-navy/8 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-navy/70">
                      {FONTE_LABEL[l.source ?? "landing"] ?? l.source}
                    </span>
                  </div>
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
                    back="/admin/contatti"
                  />
                  <LeadActions leadId={l.id} name={l.full_name} back="/admin/contatti" />
                </div>
              </div>

              {/* Risposte del questionario del funnel: prima restavano nel foglio. */}
              {l.notes && (
                <p className="mt-3 whitespace-pre-line rounded-[12px] bg-ice px-3 py-2 text-xs font-medium text-navy/80">{l.notes}</p>
              )}

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
        I contatti del funnel arrivano qui ogni notte dal foglio Google. Il CSV si apre in Google Sheets con File → Importa → Carica.
      </p>
    </>
  );
}
