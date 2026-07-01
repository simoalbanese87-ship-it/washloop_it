import { Card, PageTitle } from "@/components/app/AppShell";
import { waitlistLeads, type WaitlistLead } from "@/lib/waitlist";

/** Admin → Lista d'attesa: i lead raccolti dal funnel (funnel.washloop.it),
 *  letti dal Google Sheet via Apps Script. Ricerca per nome/email/telefono con ?q=. */

function fmt(l: WaitlistLead) {
  if (l.date) {
    try {
      return new Date(l.date).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { /* fallthrough */ }
  }
  return l.dateLabel || "—";
}

export default async function ListaAttesaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const needle = (q ?? "").trim().toLowerCase();
  const res = await waitlistLeads();

  const all = res.ok ? res.leads : [];
  const leads = needle
    ? all.filter((l) => `${l.name} ${l.email} ${l.phone} ${l.address}`.toLowerCase().includes(needle))
    : all;

  const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";

  return (
    <>
      <PageTitle
        kicker="Lista d'attesa"
        title="Lead dal funnel"
        sub={res.ok ? `${all.length} iscritti · fonte: funnel.washloop.it` : "Richieste raccolte dal funnel"}
      />

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-2">
          <label className="flex-1 text-xs font-bold text-muted">Cerca per nome, email o telefono
            <input name="q" defaultValue={q ?? ""} placeholder="mario, mario@email.it, 349…" className={`${input} mt-1`} />
          </label>
          <button type="submit" className="rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-2 font-display text-sm font-extrabold text-white">Cerca</button>
          {q && <a href="/admin/lista-attesa" className="rounded-full border border-line px-4 py-2 font-display text-sm font-bold text-navy">Pulisci</a>}
        </form>
      </Card>

      {!res.ok ? (
        <Card>
          <p className="text-sm font-semibold text-[#C0392B]">Impossibile leggere il foglio: {res.error}</p>
          <p className="mt-2 text-xs font-medium text-muted">Configura <code>FUNNEL_SHEET_URL</code> e <code>FUNNEL_SHEET_TOKEN</code> (vedi <code>web/scripts/funnel-sheet-webapp.gs</code>).</p>
        </Card>
      ) : leads.length === 0 ? (
        <Card><p className="text-sm font-medium text-muted">Nessun lead{needle ? ` per «${q}»` : ""}.</p></Card>
      ) : (
        <div className="space-y-3">
          {leads.map((l, i) => (
            <Card key={`${l.id || l.email}-${i}`} className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-display text-sm font-extrabold text-navy">{l.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-medium text-muted">
                    {l.email && <a href={`mailto:${l.email}`} className="text-blue hover:underline">{l.email}</a>}
                    {l.phone && <a href={`tel:${l.phone}`} className="hover:underline">{l.phone}</a>}
                    {l.address && <span>{l.address}</span>}
                  </div>
                </div>
                <div className="text-right text-xs font-medium text-muted">
                  <div>{fmt(l)}</div>
                  {l.id && <div className="text-[10px] opacity-70">#{l.id}</div>}
                </div>
              </div>
              {l.extra.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {l.extra.map((e, j) => (
                    <span key={j} className="inline-flex rounded-full bg-ice px-2.5 py-1 text-xs font-medium text-navy">
                      <span className="font-bold text-muted">{e.label}:</span>&nbsp;{e.value}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs font-medium text-muted">Dati live dal Google Sheet del funnel. Sola lettura.</p>
    </>
  );
}
