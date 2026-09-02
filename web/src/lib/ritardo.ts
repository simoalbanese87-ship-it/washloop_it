/** Dove finisce un sacco quando un capo dentro richiede più tempo.
 *
 *  La lavanderia dichiara una data — «questo capo sarà pronto giovedì sera» —
 *  e da lì in poi non deve decidere altro: la riconsegna la sistema il sistema.
 *  Il cliente non sceglie, viene informato.
 *
 *  Sta in un file senza dipendenze e senza `server-only` perché la regola vale
 *  più dei suoi effetti: è l'unica parte che decide una data che una persona
 *  aspetta a casa, e va potuta collaudare da sola.
 */

export type Fascia = { id: string; starts_at: string };

/** Entro quanti giorni conviene accodare il sacco a una consegna che il cliente
 *  ha GIÀ in calendario, invece di aprirne una nuova.
 *
 *  Accodare è la cosa giusta: un solo giro del furgone, e il cliente ritrova
 *  tutto insieme. Ma solo se quella consegna è vicina. Giulia oggi ha la
 *  prossima il 18 settembre: accodarle un sacco pronto il 5 vorrebbe dire
 *  tenerle il bucato in giacenza tredici giorni per una macchia, mentre ci sono
 *  fasce vuote il giorno dopo. Quattro giorni è largo abbastanza da coprire il
 *  ciclo settimanale di chi ha due ritiri, stretto abbastanza da non diventare
 *  un magazzino. */
export const ACCORPA_ENTRO_GIORNI = 4;

export type EsitoRiconsegna =
  /** La riconsegna prenotata regge: non si tocca niente. */
  | { esito: "resta"; slotId: null }
  /** Spostata: `slotId` è la fascia nuova. */
  | { esito: "spostata"; slotId: string }
  /** Nessuna fascia utile esiste. Non si inventa una data: se ne occupa una persona. */
  | { esito: "nessuna_fascia"; slotId: null };

const ms = (iso: string) => Date.parse(iso);

/** Decide dove va la riconsegna dato che un capo sarà pronto solo a `prontoStimatoIso`.
 *
 *  @param prontoStimatoIso  quando la lavanderia dice che il capo sarà pronto
 *  @param riconsegnaAttuale la fascia già promessa al cliente (null se non ne ha una)
 *  @param giaInCalendario   consegne di ALTRI ordini dello stesso cliente
 *  @param fasceLibere       fasce della stessa lavanderia con capacità residua
 */
export function scegliRiconsegna(
  prontoStimatoIso: string,
  riconsegnaAttuale: Fascia | null,
  giaInCalendario: Fascia[],
  fasceLibere: Fascia[],
  accorpaEntroGiorni: number = ACCORPA_ENTRO_GIORNI,
): EsitoRiconsegna {
  const pronto = ms(prontoStimatoIso);
  if (Number.isNaN(pronto)) return { esito: "resta", slotId: null };

  // 1. La fascia promessa regge. Il confine è incluso: una consegna che apre
  //    esattamente nell'ora in cui il capo è pronto va bene — è il caso normale
  //    di chi finisce la mattina per la fascia della mattina.
  if (riconsegnaAttuale && ms(riconsegnaAttuale.starts_at) >= pronto) {
    return { esito: "resta", slotId: null };
  }

  const dopoIlPronto = (f: Fascia) => !Number.isNaN(ms(f.starts_at)) && ms(f.starts_at) >= pronto;
  const perData = (a: Fascia, b: Fascia) => ms(a.starts_at) - ms(b.starts_at);

  // 2. Una consegna che il cliente ha già in calendario, se è vicina: il sacco
  //    viaggia con quella e non costa un giro in più.
  const tetto = pronto + accorpaEntroGiorni * 86_400_000;
  const accodabile = giaInCalendario
    .filter((f) => dopoIlPronto(f) && ms(f.starts_at) <= tetto)
    .sort(perData)[0];
  if (accodabile) return { esito: "spostata", slotId: accodabile.id };

  // 3. Altrimenti la prima fascia libera utile.
  const prima = fasceLibere.filter(dopoIlPronto).sort(perData)[0];
  if (prima) return { esito: "spostata", slotId: prima.id };

  // 4. Niente. Non si sposta a caso e non si lascia una data morta: lo guarda
  //    una persona. Una riga da sistemare a mano è meglio di una promessa che
  //    nessuno può mantenere.
  return { esito: "nessuna_fascia", slotId: null };
}

/** La nuova scadenza interna dell'ordine: la più lontana fra quella che c'era e
 *  quella dichiarata. Non si accorcia mai un `eta_ready_at` per una
 *  segnalazione — se un capo è pronto prima, l'ordine non lo è. */
export function nuovaEta(etaAttualeIso: string | null, prontoStimatoIso: string): string {
  if (!etaAttualeIso) return prontoStimatoIso;
  return ms(prontoStimatoIso) > ms(etaAttualeIso) ? prontoStimatoIso : etaAttualeIso;
}
