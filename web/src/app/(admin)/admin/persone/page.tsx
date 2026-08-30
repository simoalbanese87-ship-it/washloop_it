import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { elencoPersone, STADI, STADIO_LABEL, STADIO_TONO, type Stadio } from "@/lib/persone";
import { importaFunnelSeServe } from "@/lib/funnel-import";
import { fmtDate, eurCents } from "@/lib/format";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { LeadActions } from "@/components/admin/LeadActions";
import { CONTACT_STATUS_LABEL, isContactStatus, type ContactStatus } from "@/lib/lead-status";

export const dynamic = "force-dynamic";

/** Un parametro ripetuto nell'URL (`?stadio=lead&stadio=attivo`) arriva come
 *  array, non come stringa: senza questa riduzione il confronto `p.stadio !==
 *  stadio` sarebbe sempre vero e la tabella uscirebbe vuota mentre i chip
 *  continuano a contare giusto. */
const uno = (v: string | string[] | undefined): string | undefined =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Persone: lead e clienti nella stessa lista, ognuno con il suo stadio.
 *
 *  Rispondeva a una confusione reale: «se clicco su Contatti vedo solo i lead o
 *  anche i clienti?». Ora la domanda non si pone — c'è una lista sola, e lo
 *  stadio dice dove si trova ciascuno. */
export default async function PersonePage({
  searchParams,
}: {
  searchParams: Promise<{ stadio?: string | string[]; contatto?: string | string[]; q?: string | string[]; prova?: string | string[]; ok?: string | string[]; warn?: string | string[] }>;
}) {
  const sp = await searchParams;
  const q = uno(sp.q);
  const prova = uno(sp.prova);
  const ok = uno(sp.ok);
  const warn = uno(sp.warn);
  // Uno stadio che non esiste (link vecchio, refuso, "registrato" di prima che
  // fosse fuso in "lead") non deve svuotare la tabella senza spiegazione: si
  // ignora e si vedono tutti.
  const stadioGrezzo = uno(sp.stadio);
  const stadio = (STADI as readonly string[]).includes(stadioGrezzo ?? "") ? (stadioGrezzo as Stadio) : undefined;
  // Stato del contatto: ci si arriva dalla home ("Da contattare"), e senza
  // questo filtro quel numero aprirebbe una lista che non lo rispetta.
  const contattoGrezzo = uno(sp.contatto);
  const contatto = isContactStatus(contattoGrezzo ?? "") ? (contattoGrezzo as ContactStatus) : undefined;
  const includiProva = prova === "1";
  const needle = (q ?? "").toLowerCase();

  // Prima di leggere, tira dentro i lead del funnel: chi lascia il contatto
  // deve trovarsi qui, non domani mattina.
  await importaFunnelSeServe();
  const tutte = await elencoPersone(includiProva);

  // Un predicato solo per i chip e per la tabella. Erano due: `conta()`
  // guardava solo lo stadio mentre la tabella filtrava anche per testo, e i
  // chip si portavano dietro la ricerca — così il chip diceva "(2)" e sotto non
  // compariva nessuno. Ora i conteggi sono sempre quelli di ciò che si vede.
  const cerca = (p: (typeof tutte)[number]) =>
    !needle || `${p.nome} ${p.email ?? ""} ${p.telefono ?? ""} ${p.clientCode ?? ""}`.toLowerCase().includes(needle);
  // Lo stato non impostato vale "da contattare": è così che lo mostra la riga,
  // e un filtro che lo escludesse direbbe zero su una lista piena.
  const statoDi = (p: (typeof tutte)[number]) => (isContactStatus(p.statoContatto ?? "") ? p.statoContatto : "da_contattare");
  const base = tutte.filter((p) => cerca(p) && (!contatto || statoDi(p) === contatto));
  const lista = stadio ? base.filter((p) => p.stadio === stadio) : base;

  const conta = (s: Stadio) => base.filter((p) => p.stadio === s).length;
  const ricorrente = base.reduce((t, p) => t + p.valoreMensileCents, 0);
  const qui = `/admin/persone${stadio || contatto || q || prova ? `?${new URLSearchParams(Object.entries({ stadio, contatto, q, prova }).filter(([, v]) => v) as [string, string][])}` : ""}`;

  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ stadio, contatto, q, prova, ...patch })) if (v) u.set(k, v);
    return u.toString() ? `?${u}` : "";
  };

  const pill = (attivo: boolean) =>
    `rounded-full px-4 py-2 font-display text-sm font-bold ${attivo ? "bg-navy text-white" : "border border-line bg-white text-navy"}`;

  return (
    <>
      <PageTitle
        kicker="Persone"
        title="Lead e clienti"
        sub={`${base.length} persone · ${conta("attivo")} clienti attivi · ${eurCents(ricorrente)}/mese ricorrente`}
      />

      {ok && (
        <div className="mb-3 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-2.5 text-sm font-semibold text-[#1F8A5B]">{ok}</div>
      )}
      {warn && (
        <div className="mb-3 rounded-[14px] border border-[#C0392B]/30 bg-[#C0392B]/8 px-4 py-2.5 text-sm font-semibold text-[#C0392B]">{warn}</div>
      )}

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
            Tutti ({base.length})
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

        {contatto && (
          <p className="mt-2 text-xs font-medium text-muted">
            Filtrato per stato del contatto: <strong>{CONTACT_STATUS_LABEL[contatto]}</strong>.{" "}
            <Link href={`/admin/persone${qs({ contatto: undefined })}`} className="font-display font-bold text-blue hover:underline">
              Togli il filtro
            </Link>
          </p>
        )}
        {q && (
          <p className="mt-2 text-xs font-medium text-muted">
            I conteggi qui sopra sono quelli della ricerca «{q}».{" "}
            <Link href={`/admin/persone${qs({ q: undefined })}`} className="font-display font-bold text-blue hover:underline">
              Azzera la ricerca
            </Link>
          </p>
        )}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
                <th className="py-2">Persona</th>
                <th className="py-2">Codice</th>
                <th className="py-2">Stadio</th>
                <th className="py-2">Contatto</th>
                <th className="py-2">Valore</th>
                <th className="py-2">Ordini</th>
                <th className="py-2">Da</th>
                <th className="py-2 text-right">Azioni</th>
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
                    {/* Da quando "Registrato" è dentro "Lead", questo è il segnale che
                        distingue un contatto freddo da uno che si è già registrato. */}
                    {p.stadio === "lead" && p.profileId && (
                      <span className="ml-1 rounded-full bg-[#2b7fd4]/12 px-2 py-0.5 text-[10px] font-bold text-blue">ha account</span>
                    )}
                    {p.isTest && <span className="ml-1 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy/60">prova</span>}
                  </td>
                  <td className="py-2.5">
                    <LeadStatusSelect
                      leadId={p.leadId ?? undefined}
                      profileId={p.profileId ?? undefined}
                      value={isContactStatus(p.statoContatto ?? "") ? (p.statoContatto as ContactStatus) : "da_contattare"}
                      back={qui}
                    />
                    {!isContactStatus(p.statoContatto ?? "") && (
                      <div className="mt-0.5 text-[10px] font-medium text-muted">mai impostato</div>
                    )}
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
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-3">
                      {p.profileId ? (
                        <Link href={`/admin/abbonati/${p.profileId}`} className="font-display text-xs font-bold text-blue hover:underline">
                          Scheda →
                        </Link>
                      ) : (
                        <LeadActions leadId={p.leadId!} name={p.nome} back={qui} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && <p className="py-3 text-sm font-medium text-muted">Nessuna persona con questi filtri.</p>}
        </div>
      </Card>

      <p className="mt-3 text-xs font-medium text-muted">
        Una persona compare una volta sola: chi ha lasciato il contatto e poi si è registrato viene unito per email o telefono.
        I lead senza account non hanno codice cliente, perché il codice nasce con la registrazione: quelli che ce l’hanno
        portano il segno «ha account», hanno aperto un profilo ma non hanno ancora pagato.
        <br />
        Gli stadi seguono i soldi: <strong>Lead</strong> non ha mai pagato · <strong>Cliente attivo</strong> paga
        · <strong>Pagamento fallito</strong> ha una fattura rimasta aperta · <strong>Cliente perso</strong> ha disdetto.
      </p>
    </>
  );
}
