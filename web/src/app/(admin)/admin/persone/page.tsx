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
import { impersonate, createDemoCustomer } from "@/lib/actions/impersonate";
import { createCustomer } from "@/lib/actions/admin-customer";
import { Button } from "@/components/ui/Button";
import { createServiceClient } from "@/lib/supabase/server";
import { CONTACT_STATUS, CONTACT_STATUS_LABEL, isContactStatus, type ContactStatus } from "@/lib/lead-status";
import { cadenzaTesto } from "@/lib/durata-abbonamento";

export const dynamic = "force-dynamic";

/** Un parametro ripetuto nell'URL (`?stadio=lead&stadio=attivo`) arriva come
 *  array, non come stringa: senza questa riduzione il confronto `p.stadio !==
 *  stadio` sarebbe sempre vero e la tabella uscirebbe vuota mentre i chip
 *  continuano a contare giusto. */
const uno = (v: string | string[] | undefined): string | undefined =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

const campo = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";

/** Persone: lead e clienti nella stessa lista, ognuno con il suo stadio.
 *
 *  Rispondeva a una confusione reale: «se clicco su Contatti vedo solo i lead o
 *  anche i clienti?». Ora la domanda non si pone — c'è una lista sola, e lo
 *  stadio dice dove si trova ciascuno. */
export default async function PersonePage({
  searchParams,
}: {
  searchParams: Promise<{ stadio?: string | string[]; contatto?: string | string[]; zona?: string | string[]; q?: string | string[]; prova?: string | string[]; disiscritti?: string | string[]; archiviati?: string | string[]; ok?: string | string[]; warn?: string | string[] }>;
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
  // Gli archiviati stanno fuori dall'elenco di lavoro, e si rivedono solo
  // chiedendolo: è il senso dell'archivio. Il chip li mostra da soli, perché
  // mescolati agli altri non si distinguerebbero da chi è ancora da chiamare.
  const archiviatiSolo = uno(sp.archiviati) === "1";
  const includiProva = prova === "1";
  const needle = (q ?? "").toLowerCase();

  // Prima di leggere, tira dentro i lead del funnel: chi lascia il contatto
  // deve trovarsi qui, non domani mattina.
  await importaFunnelSeServe();
  const [tutte, { data: piani }] = await Promise.all([
    elencoPersone(includiProva, archiviatiSolo),
    createServiceClient().from("plans").select("id, name").eq("active", true).order("sort").returns<{ id: string; name: string }[]>(),
  ]);

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
    (p) => cerca(p) && (!contatto || statoDi(p) === contatto) && (!zona || inZonaDi(p)) && (!disiscrittiSolo || p.disiscritto) && (archiviatiSolo ? p.archiviato : true),
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
  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const correnti = { stadio, contatto, zona, q, prova, disiscritti: disiscrittiSolo ? "1" : undefined, archiviati: archiviatiSolo ? "1" : undefined };
    for (const [k, v] of Object.entries({ ...correnti, ...patch })) if (v) u.set(k, v);
    return u.toString() ? `?${u}` : "";
  };

  // Dove si torna dopo un'azione: esattamente la vista che si stava guardando,
  // filtri compresi. Prima era una seconda costruzione dell'URL che si era
  // dimenticata «disiscritti» — si premeva «Salva la nota» dentro un filtro e
  // si tornava a un elenco diverso da quello di partenza.
  const qui = `/admin/persone${qs({})}`;

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
            <form action={createDemoCustomer}>
              <BottoneInvio attesa="Creo…" className="font-display text-xs font-bold text-navy/55 hover:text-navy">
                Cliente demo e simula →
              </BottoneInvio>
            </form>
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
          <Link
            href={`/admin/persone${qs({ archiviati: archiviatiSolo ? undefined : "1" })}`}
            className={pill(archiviatiSolo)}
          >
            Archiviati
          </Link>
        </div>

        <form className="mt-3 flex flex-wrap items-center gap-2">
          {stadio && <input type="hidden" name="stadio" value={stadio} />}
          {zona && <input type="hidden" name="zona" value={zona} />}
          {contatto && <input type="hidden" name="contatto" value={contatto} />}
          {prova && <input type="hidden" name="prova" value={prova} />}
          {disiscrittiSolo && <input type="hidden" name="disiscritti" value="1" />}
          {archiviatiSolo && <input type="hidden" name="archiviati" value="1" />}
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

      {/* Creare un cliente stava nell'elenco abbonati, che non esiste più.
          Chiuso in un `details` perché è il gesto raro: questa pagina si apre
          cento volte per guardare e una per creare. */}
      <details className="mb-4 rounded-[18px] border border-line bg-white px-4 py-3">
        <summary className="cursor-pointer list-none font-display text-sm font-extrabold text-navy">
          + Crea un cliente
        </summary>
        <p className="mt-1 text-xs font-medium text-muted">
          Crea un cliente con abbonamento attivo. Lascia vuoto il prezzo per usare quello del piano; inseriscilo per un
          prezzo concordato (es. sotto lo Small) — fatturazione manuale.
        </p>
        <form action={createCustomer} className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1.4fr_1fr_1fr_0.8fr_auto] sm:items-end">
          <label className="text-xs font-bold text-muted">Nome e cognome<input name="full_name" required className={campo} /></label>
          <label className="text-xs font-bold text-muted">Email<input name="email" required type="email" className={campo} /></label>
          <label className="text-xs font-bold text-muted">Telefono<input name="phone" className={campo} /></label>
          <label className="text-xs font-bold text-muted">Piano
            <select name="plan_id" className={campo} defaultValue="">
              <option value="">—</option>
              {(piani ?? []).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted">Prezzo €<input name="price_eur" type="number" step="0.01" min="0" placeholder="custom" className={campo} /></label>
          <Button type="submit" size="md">Crea →</Button>
        </form>
      </details>

      {/* Una scheda per persona, non una riga di tabella.
          ------------------------------------------------
          La tabella aveva undici colonne: su qualunque schermo scorreva in
          orizzontale, e la colonna che serve davvero — la nota del telefono —
          era l'ultima, cioè quella che restava fuori. Si leggeva «Inte… sol…
          Con…» e per sapere cosa ci si era detti bisognava trascinare.
          Le pastiglie, strette fra due colonne, si spezzavano a metà parola
          («CONTATTO ha / l'accesso»).

          Qui ogni persona è un blocco che occupa la larghezza che ha:
          chi è e come si contatta in alto a sinistra, stato e servizio a
          destra, la nota sotto a tutta riga. Niente scorrimento laterale,
          niente testo tagliato, e la riga resta scansionabile dall'alto
          perché il nome e le pastiglie stanno sempre nello stesso punto. */}
      <div className="space-y-3">
        {lista.map((p) => (
          <Card key={p.id} className="!p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {/* Tutti i nomi si aprono: chi ha l'accesso sulla sua scheda
                      cliente, chi non ce l'ha sulla scheda del contatto. */}
                  <Link
                    href={p.profileId ? `/admin/abbonati/${p.profileId}` : `/admin/persone/${p.leadId}`}
                    className="font-display text-base font-extrabold text-navy hover:underline"
                  >
                    {p.nome}
                  </Link>
                  {/* `whitespace-nowrap` su tutte: una pastiglia che va a capo
                      a metà parola si legge come due pastiglie rotte. */}
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${STADIO_TONO[p.stadio]}`}>
                    {STADIO_LABEL[p.stadio]}
                  </span>
                  {p.stadio === "lead" && p.profileId && (
                    <span className="whitespace-nowrap rounded-full bg-[#2b7fd4]/12 px-2 py-0.5 text-[10px] font-bold text-blue" title="Ha un accesso a WashLoop: può entrare in app, e tu puoi entrare come lui.">
                      ha l’accesso
                    </span>
                  )}
                  {/* «Convertito» senza accesso è una bugia: lo stato lo mette
                      una persona a mano, l'account no. */}
                  {p.statoContatto === "convertito" && !p.profileId && (
                    <span
                      className="whitespace-nowrap rounded-full bg-[#C0392B]/12 px-2 py-0.5 text-[10px] font-extrabold text-[#C0392B]"
                      title="Segnato come convertito, ma non ha un accesso a WashLoop: premi «Crea cliente» per aprirglielo."
                    >
                      senza accesso
                    </span>
                  )}
                  {p.isTest && <span className="whitespace-nowrap rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy/60">prova</span>}
                  {p.disiscritto && (
                    <span className="whitespace-nowrap rounded-full bg-[#C0392B]/12 px-2 py-0.5 text-[10px] font-extrabold text-[#C0392B]" title="Ha chiesto di non ricevere più email">
                      disiscritto
                    </span>
                  )}
                  {p.archiviato && (
                    <span className="whitespace-nowrap rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy/60">archiviato</span>
                  )}
                </div>

                {/* Come lo si raggiunge: la riga che si copia per telefonare. */}
                <div className="mt-1 truncate text-sm font-medium text-muted">
                  {p.email ?? "—"}
                  {p.telefono && ` · ${p.telefono}`}
                </div>

                {/* Il contorno, in una riga sola e in grigio: serve a decidere
                    se chiamare, non a essere letto per primo. */}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-muted">
                  {p.clientCode && <span className="font-mono font-bold text-navy">{p.clientCode}</span>}
                  {p.cap && (
                    <span className={p.inZona === false ? "font-bold text-[#C0392B]" : ""}>
                      {p.cap}
                      {p.inZona === false ? " · fuori zona" : p.zona ? ` · ${p.zona}` : ""}
                    </span>
                  )}
                  {p.provenienza && <span>da {p.provenienza}</span>}
                  <span>dal {fmtDate(p.creatoIl)}</span>
                  <span>
                    {p.ordini} {p.ordini === 1 ? "ordine" : "ordini"}
                    {p.ultimoOrdine ? ` · ultimo ${fmtDate(p.ultimoOrdine)}` : ""}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {p.profileId ? (
                    <>
                      <Link href={`/admin/abbonati/${p.profileId}`} className="font-display text-xs font-bold text-blue hover:underline">
                        Scheda →
                      </Link>
                      <form action={impersonate}>
                        <input type="hidden" name="user_id" value={p.profileId} />
                        <BottoneInvio attesa="Entro…" className="font-display text-xs font-bold text-blue hover:underline">
                          Accedi come →
                        </BottoneInvio>
                      </form>
                      <DeleteUserButton id={p.profileId} name={p.nome} back={qui} />
                    </>
                  ) : (
                    <LeadActions leadId={p.leadId!} name={p.nome} back={qui} archiviato={p.archiviato} />
                  )}
                </div>
              </div>

              {/* Quello che si cambia: stato del contatto, servizio, e quanto
                  vale. Su schermo largo sta a destra, su stretto va sotto. */}
              <div className="flex flex-col gap-2 lg:items-end">
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <LeadStatusSelect
                    leadId={p.leadId ?? undefined}
                    profileId={p.profileId ?? undefined}
                    value={isContactStatus(p.statoContatto ?? "") ? (p.statoContatto as ContactStatus) : "da_contattare"}
                    back={qui}
                  />
                  {/* Il tipo di servizio vive solo su chi ha un account: un
                      contatto non ha un servizio, ha una richiesta. */}
                  {p.profileId && <TipoServizioSelect profileId={p.profileId} value={p.tipoServizio} back={qui} />}
                </div>
                {!isContactStatus(p.statoContatto ?? "") && (
                  <div className="text-[10px] font-medium text-muted lg:text-right">stato mai impostato</div>
                )}
                {/* La cadenza accanto all'importo: 40 € per una settimana non
                    è «40 €/mese», ed è così che si leggeva. */}
                {p.valoreMensileCents > 0 && (
                  <div className="font-display text-sm font-extrabold text-navy lg:text-right">
                    {eurCents(p.valoreMensileCents)}
                    {cadenzaTesto(p.settimane)}
                    {p.rinnovo && p.stadio === "attivo" && (
                      <span className={`block text-[11px] font-medium ${p.disdetto ? "text-[#C9881F]" : "text-muted"}`}>
                        {p.disdetto ? "finisce" : "rinnovo"} {fmtDate(p.rinnovo)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* La nota, a tutta riga. È la cosa che si viene a leggere qui
                dentro: prima stava in una colonna da 300px in fondo a una
                tabella che scorreva, cioè fuori dallo schermo. */}
            <div className="mt-3 rounded-[12px] bg-ice/70 px-3 py-2">
              <NotaPersona profileId={p.profileId} leadId={p.leadId} nota={p.nota} back={qui} />
            </div>
          </Card>
        ))}
        {lista.length === 0 && (
          <Card>
            <p className="text-sm font-medium text-muted">Nessuna persona con questi filtri.</p>
          </Card>
        )}
      </div>

      <p className="mt-3 text-xs font-medium text-muted">
        <strong className="text-navy">Contatto</strong>{" "}vuol dire che ci ha lasciato i suoi dati e basta:
        nome, telefono, CAP. <strong className="text-navy">L’accesso</strong>{" "}è un’altra cosa — è il suo account
        WashLoop, con email e password. Senza accesso non può entrare in app, non gli si può creare un ritiro e non gli
        si può addebitare niente: tutto quello vive sull’account. Glielo apri con{" "}
        <strong className="text-navy">Crea cliente</strong>, e da quel momento è una scheda cliente come le altre.
        <br />
        Ogni nome si apre: chi ha l’accesso sulla sua scheda cliente, chi non ce l’ha sulla scheda del contatto.
        Una persona compare una volta sola: chi ha lasciato il contatto e poi si è registrato viene unito per email o telefono.
        La nota in fondo a ogni scheda è la stessa che vedi dentro la scheda cliente: si scrive qui e si legge là.
        <br />
        Gli stadi seguono i soldi: <strong>Contatto</strong> non ha mai pagato · <strong>Cliente attivo</strong>{" "}paga
        · <strong>Pagamento fallito</strong> ha una fattura rimasta aperta · <strong>Cliente perso</strong> ha disdetto.
      </p>
    </>
  );
}
