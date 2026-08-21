import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { elencoPersone, STADI, STADIO_LABEL, STADIO_TONO, type Stadio } from "@/lib/persone";
import { fmtDate, eurCents } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Persone: lead e clienti nella stessa lista, ognuno con il suo stadio.
 *
 *  Rispondeva a una confusione reale: «se clicco su Contatti vedo solo i lead o
 *  anche i clienti?». Ora la domanda non si pone — c'è una lista sola, e lo
 *  stadio dice dove si trova ciascuno. */
export default async function PersonePage({
  searchParams,
}: {
  searchParams: Promise<{ stadio?: string; q?: string; prova?: string }>;
}) {
  const { stadio, q, prova } = await searchParams;
  const includiProva = prova === "1";
  const needle = (q ?? "").trim().toLowerCase();

  const tutte = await elencoPersone(includiProva);
  const lista = tutte.filter((p) => {
    if (stadio && p.stadio !== stadio) return false;
    if (!needle) return true;
    return `${p.nome} ${p.email ?? ""} ${p.telefono ?? ""} ${p.clientCode ?? ""}`.toLowerCase().includes(needle);
  });

  const conta = (s: Stadio) => tutte.filter((p) => p.stadio === s).length;
  const ricorrente = tutte.reduce((t, p) => t + p.valoreMensileCents, 0);

  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ stadio, q, prova, ...patch })) if (v) u.set(k, v);
    return u.toString() ? `?${u}` : "";
  };

  const pill = (attivo: boolean) =>
    `rounded-full px-4 py-2 font-display text-sm font-bold ${attivo ? "bg-navy text-white" : "border border-line bg-white text-navy"}`;

  return (
    <>
      <PageTitle
        kicker="Persone"
        title="Lead e clienti"
        sub={`${tutte.length} persone · ${conta("attivo")} clienti attivi · ${eurCents(ricorrente)}/mese ricorrente`}
      />

      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted">
            Lead e clienti nella stessa lista. Lo stadio dice a che punto è ciascuno.
          </p>
          <Link href="/admin/abbonati" className="font-display text-xs font-bold text-blue hover:underline">
            Crea cliente o accedi come cliente →
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/persone${qs({ stadio: undefined })}`} className={pill(!stadio)}>
            Tutti ({tutte.length})
          </Link>
          {STADI.map((s) => (
            <Link key={s} href={`/admin/persone${qs({ stadio: s })}`} className={pill(stadio === s)}>
              {STADIO_LABEL[s]} ({conta(s)})
            </Link>
          ))}
        </div>

        <form className="mt-3 flex flex-wrap items-center gap-2">
          {stadio && <input type="hidden" name="stadio" value={stadio} />}
          {prova && <input type="hidden" name="prova" value={prova} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cerca per nome, email, telefono o codice cliente…"
            className="h-10 min-w-[260px] flex-1 rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue"
          />
          <button type="submit" className="rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-2 font-display text-sm font-extrabold text-white">
            Cerca
          </button>
          <Link href={`/admin/persone${qs({ prova: includiProva ? undefined : "1" })}`} className="font-display text-xs font-bold text-navy/55 hover:text-navy">
            {includiProva ? "Nascondi dati di prova" : "Mostra dati di prova"}
          </Link>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
                <th className="py-2">Persona</th>
                <th className="py-2">Codice</th>
                <th className="py-2">Stadio</th>
                <th className="py-2">Valore</th>
                <th className="py-2">Ordini</th>
                <th className="py-2">Da</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-b border-line/70 last:border-0">
                  <td className="py-2.5">
                    {p.profileId ? (
                      <Link href={`/admin/abbonati/${p.profileId}`} className="font-display font-bold text-navy hover:underline">
                        {p.nome}
                      </Link>
                    ) : (
                      <span className="font-display font-bold text-navy">{p.nome}</span>
                    )}
                    <div className="text-xs font-medium text-muted">
                      {p.email ?? "—"}
                      {p.telefono && ` · ${p.telefono}`}
                      {p.provenienza && ` · da ${p.provenienza}`}
                    </div>
                  </td>
                  <td className="py-2.5 font-mono text-xs font-bold text-navy">{p.clientCode ?? "—"}</td>
                  <td className="py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${STADIO_TONO[p.stadio]}`}>
                      {STADIO_LABEL[p.stadio]}
                    </span>
                    {p.isTest && <span className="ml-1 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy/60">prova</span>}
                  </td>
                  <td className="py-2.5 font-display font-extrabold text-navy">
                    {p.valoreMensileCents > 0 ? `${eurCents(p.valoreMensileCents)}/mese` : "—"}
                    {p.rinnovo && p.stadio === "attivo" && (
                      <div className="text-[11px] font-medium text-muted">rinnovo {fmtDate(p.rinnovo)}</div>
                    )}
                  </td>
                  <td className="py-2.5 text-muted">
                    {p.ordini}
                    {p.ultimoOrdine && <div className="text-[11px]">ultimo {fmtDate(p.ultimoOrdine)}</div>}
                  </td>
                  <td className="py-2.5 text-xs text-muted">{fmtDate(p.creatoIl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && <p className="py-3 text-sm font-medium text-muted">Nessuna persona con questi filtri.</p>}
        </div>
      </Card>

      <p className="mt-3 text-xs font-medium text-muted">
        Una persona compare una volta sola: chi ha lasciato il contatto e poi si è registrato viene unito per email o telefono.
        I lead senza account non hanno codice cliente, perché il codice nasce con la registrazione.
      </p>
    </>
  );
}
