import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { elencoPersone, STADI, STADIO_LABEL, STADIO_TONO, type Stadio } from "@/lib/persone";
import { importaFunnelSeServe } from "@/lib/funnel-import";
import { fmtDate, eurCents } from "@/lib/format";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { TipoServizioSelect } from "@/components/admin/TipoServizioSelect";
import { NotaPersona } from "@/components/admin/NotaPersona";
import { LeadActions } from "@/components/admin/LeadActions";
import { DeleteUserButton } from "@/components/admin/DeleteUserButton";
import { BottoneInvio } from "@/components/ui/BottoneInvio";
import { impersonate } from "@/lib/actions/impersonate";
import { CONTACT_STATUS, CONTACT_STATUS_LABEL, isContactStatus, type ContactStatus } from "@/lib/lead-status";
import { cadenzaTesto } from "@/lib/durata-abbonamento";

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
  searchParams: Promise<{ stadio?: string | string[]; contatto?: string | string[]; zona?: string | string[]; q?: string | string[]; prova?: string | string[]; disiscritti?: string | string[]; ok?: string | string[]; warn?: string | string[] }>;
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
  // Zona: la domanda vera non è «questo è coperto?» ma «fammi vedere i fuori
  // zona», e con qualche decina di righe un badge in mezzo alla tabella si
  // perde. Un valore che non esiste si ignora, come per lo stadio.
  const zonaGrezza = uno(sp.zona);
  const zona = zonaGrezza === "in" || zonaGrezza === "fuori" ? zonaGrezza : undefined;
  // Chi ha chiesto di non ricevere più email. Il dato c'era in due tabelle e
  // non si vedeva da nessuna parte: senza questo filtro, per sapere a chi non
  // scrivere bisognava aprire Brevo.
  const disiscrittiSolo = uno(sp.disiscritti) === "1";
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
    !needle || `${p.nome} ${p.email ?? ""} ${p.telefono ?? ""} ${p.clientCode ?? ""} ${p.cap ?? ""}`.toLowerCase().includes(needle);
  // Lo stato non impostato vale "da contattare": è così che lo mostra la riga,
  // e un filtro che lo escludesse direbbe zero su una lista piena.
  const statoDi = (p: (typeof tutte)[number]) => (isContactStatus(p.statoContatto ?? "") ? p.statoContatto : "da_contattare");
  // Chi non ha CAP non è «fuori zona», è sconosciuto: non entra in nessuno dei
  // due filtri, altrimenti «fuori zona» diventerebbe un cestino.
  const inZonaDi = (p: (typeof tutte)[number]) => (zona === "in" ? p.inZona === true : p.inZona === false);
  const base = tutte.filter(
    (p) => cerca(p) && (!contatto || statoDi(p) === contatto) && (!zona || inZonaDi(p)) && (!disiscrittiSolo || p.disiscritto),
  );
  const lista = stadio ? base.filter((p) => p.stadio === stadio) : base;

  const conta = (s: Stadio) => base.filter((p) => p.stadio === s).length;
  // I conteggi dei chip «Contatto» non devono risentire del chip «Contatto»
  // gia' scelto, altrimenti tutti gli altri direbbero zero.
  const senzaZona = tutte.filter((p) => cerca(p) && (!contatto || statoDi(p) === contatto) && (!stadio || p.stadio === stadio));
  const senzaContatto = tutte.filter((p) => cerca(p) && (!zona || inZonaDi(p)) && (!stadio || p.stadio === stadio));
  const contaContatto = (c: string) => senzaContatto.filter((p) => statoDi(p) === c).length;
  // «Ricorrente» vuol dire che torna ogni mese: un pacchetto a termine, o un
  // abbonamento gia' disdetto, il mese prossimo non c'e' piu'.
  const ricorrente = base.reduce((t, p) => t + (p.settimane || p.disdetto ? 0 : p.valoreMensileCents), 0);
  const qui = `/admin/persone${stadio || contatto || zona || q || prova ? `?${new URLSearchParams(Object.entries({ stadio, contatto, zona, q, prova }).filter(([, v]) => v) as [string, string][])}` : ""}`;

  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const correnti = { stadio, contatto, zona, q, prova, disiscritti: disiscrittiSolo ? "1" : undefined };
    for (const [k, v] of Object.entries({ ...correnti, ...patch })) if (v) u.set(k, v);
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
          <div className="flex flex-wrap items-center gap-3">
            {/* L'export esisteva gia', con dentro CAP, Zona e Copertura, e non
                era raggiungibile da nessuna pagina. I filtri che si vedono a
                schermo viaggiano con lui: scaricare qualcosa di diverso da
                quello che si sta guardando e' il modo piu' rapido di non
                fidarsi piu' del file. */}
            <a
              href={`/admin/contatti/export${
                new URLSearchParams(
                  Object.entries({ q, zona, stato: contatto }).filter(([, v]) => v) as [string, string][],
                ).toString()
                  ? `?${new URLSearchParams(Object.entries({ q, zona, stato: contatto }).filter(([, v]) => v) as [string, string][])}`
                  : ""
              }`}
              className="font-display text-xs font-bold text-navy/55 hover:text-navy"
            >
              Scarica CSV ↓
            </a>
            <Link href="/admin/abbonati" className="font-display text-xs font-bold text-blue hover:underline">
              Crea cliente o accedi come cliente →
            </Link>
          </div>
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

        {/* Lo stato del contatto: il filtro c'era gia' e ci si arrivava solo
            dalla Home, con un link. Da qui dentro non si poteva chiedere «chi
            devo ancora chiamare», che e' la domanda per cui questa pagina
            esiste. I conteggi sono quelli di cio' che si vede, come gli altri. */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-navy/40">Contatto</span>
          <Link href={`/admin/persone${qs({ contatto: undefined })}`} className={pill(!contatto)}>
            Tutti
          </Link>
          {CONTACT_STATUS.map((c) => (
            <Link key={c} href={`/admin/persone${qs({ contatto: c })}`} className={pill(contatto === c)}>
              {CONTACT_STATUS_LABEL[c]} ({contaContatto(c)})
            </Link>
          ))}
        </div>

        {/* Il filtro della copertura, staccato dai chip dello stadio: sono due
            domande diverse e si incrociano — «lead fuori zona» è la ricerca che
            serve davvero quando le richieste arrivano da tutta la citta'. */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-navy/40">Zona</span>
          <Link href={`/admin/persone${qs({ zona: undefined })}`} className={pill(!zona)}>
            Tutte
          </Link>
          <Link href={`/admin/persone${qs({ zona: "in" })}`} className={pill(zona === "in")}>
            In zona ({senzaZona.filter((p) => p.inZona === true).length})
          </Link>
          <Link href={`/admin/persone${qs({ zona: "fuori" })}`} className={pill(zona === "fuori")}>
            Fuori zona ({senzaZona.filter((p) => p.inZona === false).length})
          </Link>
          <Link
            href={`/admin/persone${qs({ disiscritti: disiscrittiSolo ? undefined : "1" })}`}
            className={pill(disiscrittiSolo)}
          >
            Disiscritti ({tutte.filter((p) => p.disiscritto).length})
          </Link>
        </div>

        <form className="mt-3 flex flex-wrap items-center gap-2">
          {stadio && <input type="hidden" name="stadio" value={stadio} />}
          {zona && <input type="hidden" name="zona" value={zona} />}
          {contatto && <input type="hidden" name="contatto" value={contatto} />}
          {prova && <input type="hidden" name="prova" value={prova} />}
          {disiscrittiSolo && <input type="hidden" name="disiscritti" value="1" />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cerca per nome, email, telefono, CAP o codice cliente…"
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
          <table className="w-full min-w-[1340px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
                <th className="py-2">Persona</th>
                <th className="py-2 pr-4">Codice</th>
                <th className="py-2 pr-4">Zona</th>
                <th className="py-2">Stadio</th>
                <th className="py-2">Contatto</th>
                <th className="py-2">Servizio</th>
                <th className="py-2">Valore</th>
                <th className="py-2">Ordini</th>
                <th className="py-2">Da</th>
                <th className="w-[230px] py-2">Note</th>
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
                  <td className="py-2.5 pr-4 font-mono text-xs font-bold text-navy">{p.clientCode ?? "—"}</td>
                  {/* Il CAP, e se lo serviamo. Senza, un fuori zona si
                      distingueva da un lead buono solo aprendo la scheda. Niente
                      CAP = trattino e non badge: non sapere non e' «fuori». */}
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {p.cap ? (
                      <>
                        {/* Il CAP in rosso fa il lavoro che faceva il badge
                            «fuori zona», con un quarto dello spazio: in una
                            tabella larga quello che si nota e' il colore, non
                            una parola in piu' accanto a cinque cifre. */}
                        <span
                          className={`font-mono text-xs font-bold ${p.inZona === false ? "text-[#C0392B]" : "text-navy"}`}
                          title={p.inZona === false ? "Fuori zona" : p.zona ?? undefined}
                        >
                          {p.cap}
                        </span>
                        <div className={`text-[11px] font-semibold ${p.inZona === false ? "text-[#C0392B]/70" : "text-muted"}`}>
                          {p.inZona === false ? "fuori zona" : p.zona ?? ""}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs font-medium text-muted">—</span>
                    )}
                  </td>
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
                    {/* Scritto qui e non in una colonna sua: è una cosa che si
                        deve notare leggendo la riga, non cercando. */}
                    {p.disiscritto && (
                      <span className="ml-1 rounded-full bg-[#C0392B]/12 px-2 py-0.5 text-[10px] font-extrabold text-[#C0392B]" title="Ha chiesto di non ricevere più email">
                        disiscritto
                      </span>
                    )}
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
                  {/* Il tipo di servizio vive solo su chi ha un account: un
                      lead non ha un servizio, ha una richiesta. */}
                  <td className="py-2.5">
                    {p.profileId ? (
                      <TipoServizioSelect profileId={p.profileId} value={p.tipoServizio} back={qui} />
                    ) : (
                      <span className="text-xs font-medium text-muted">—</span>
                    )}
                  </td>
                  {/* La cadenza accanto all'importo, e la parola giusta sotto.
                      Una prova a pagamento da 40 EUR per una settimana si
                      leggeva «40,00 EUR/mese · rinnovo 08/10»: sbagliato due
                      volte, perche' non e' mensile e perche' non si rinnova. */}
                  <td className="py-2.5 font-display font-extrabold text-navy">
                    {p.valoreMensileCents > 0 ? `${eurCents(p.valoreMensileCents)}${cadenzaTesto(p.settimane)}` : "—"}
                    {p.rinnovo && p.stadio === "attivo" && (
                      <div className={`text-[11px] font-medium ${p.disdetto ? "text-[#C9881F]" : "text-muted"}`}>
                        {p.disdetto ? "finisce" : "rinnovo"} {fmtDate(p.rinnovo)}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 text-muted">
                    {p.ordini}
                    {p.ultimoOrdine && <div className="text-[11px]">ultimo {fmtDate(p.ultimoOrdine)}</div>}
                  </td>
                  <td className="py-2.5 text-xs text-muted">{fmtDate(p.creatoIl)}</td>
                  {/* Dove si telefona è anche dove si scrive cosa ci si è detti.
                      Sui clienti è la stessa casella della scheda, non una
                      seconda: se fossero due, nessuno saprebbe quale vale. */}
                  {/* Larghezza fissa: senza, una nota lunga allargava la colonna
                      e spingeva «Azioni» oltre il bordo della tabella. */}
                  <td className="w-[230px] max-w-[230px] py-2.5 align-top">
                    <NotaPersona profileId={p.profileId} leadId={p.leadId} nota={p.nota} back={qui} />
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-3">
                      {p.profileId ? (
                        <>
                          <Link href={`/admin/abbonati/${p.profileId}`} className="font-display text-xs font-bold text-blue hover:underline">
                            Scheda →
                          </Link>
                          {/* Vedere l'app com'è per il cliente, senza passare
                              dall'elenco abbonati: qui c'è chi ti ha appena
                              scritto che qualcosa non gli funziona. */}
                          <form action={impersonate}>
                            <input type="hidden" name="user_id" value={p.profileId} />
                            <BottoneInvio attesa="Entro…" className="font-display text-xs font-bold text-blue hover:underline">
                              Accedi come →
                            </BottoneInvio>
                          </form>
                          {/* Cancellare si poteva gia', ma solo dalla scheda:
                              per togliere un doppione bisognava aprirlo,
                              scorrere e tornare indietro. Le guardie vere —
                              abbonamento in corso, ordini aperti — restano
                              lato server e dicono perche' non si puo'. */}
                          <DeleteUserButton id={p.profileId} name={p.nome} back={qui} />
                        </>
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
        Gli stadi seguono i soldi: <strong>Lead</strong> non ha mai pagato · <strong>Cliente attivo</strong>{" "}paga
        · <strong>Pagamento fallito</strong> ha una fattura rimasta aperta · <strong>Cliente perso</strong> ha disdetto.
      </p>
    </>
  );
}
