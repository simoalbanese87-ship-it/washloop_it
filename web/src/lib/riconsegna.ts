/** Quando il bucato può tornare indietro, e quali fasce ha senso proporre.
 *
 *  Il calcolo è banale e sbagliarlo è invisibile: una fascia proposta un'ora
 *  troppo presto diventa un rider che suona a una porta con un sacco che è
 *  ancora in lavatrice. Sta qui, senza `server-only`, perché lo usa il flusso
 *  di prenotazione (client) e va potuto collaudare da solo.
 *
 *  Nota: la schermata di conferma prometteva «entro 72h». Non è mai stato vero
 *  — la lavorazione è di 48 ore, 24 sui piani veloci — ed è il motivo per cui
 *  quel numero non compare più da nessuna parte. */

export type FasciaRiconsegna = { id: string; starts_at: string };

/** Il momento da cui il bucato è pronto: inizio del ritiro + ore di
 *  lavorazione del piano. Stesso conto di `eta_ready_at` sull'ordine. */
export function prontoDa(inizioRitiroIso: string, turnaroundHours: number): Date {
  return new Date(new Date(inizioRitiroIso).getTime() + turnaroundHours * 3600_000);
}

/** Quanti giorni dopo la fine della lavorazione si può ancora scegliere.
 *
 *  Senza tetto una cliente vera ha prenotato il ritiro il 23 settembre e la
 *  riconsegna il 30 ottobre: cinque settimane con il suo bucato in giacenza da
 *  noi. Il vincolo era solo verso il basso — non prima che sia pronto — e verso
 *  l'alto non c'era niente. Una settimana è larga abbastanza per far scegliere
 *  con comodo e stretta abbastanza da restare un servizio di lavanderia. */
export const FINESTRA_GIORNI = 7;

/** Le fasce proponibili: da quando il bucato è pronto fino a `finestraGiorni`
 *  dopo. Il confine inferiore è incluso — una fascia che apre esattamente
 *  all'ora in cui la lavorazione finisce è buona. */
export function fasceProponibili<T extends FasciaRiconsegna>(
  fasce: T[],
  inizioRitiroIso: string,
  turnaroundHours: number,
  finestraGiorni: number = FINESTRA_GIORNI,
): T[] {
  const soglia = prontoDa(inizioRitiroIso, turnaroundHours).getTime();
  const tetto = soglia + finestraGiorni * 86_400_000;
  return fasce
    .filter((f) => {
      const t = new Date(f.starts_at).getTime();
      return t >= soglia && t <= tetto;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Che fine fa la riconsegna quando il ritiro si sposta.
 *
 *  Il difetto che chiude
 *  ---------------------
 *  `spostaRitiro` aggiornava **solo** `pickup_slot_id`. Sposti il ritiro tre
 *  giorni avanti e la riconsegna resta dov'era: il cliente si ritrova la
 *  riconsegna prima del ritiro, e nessuno se ne accorge finché il rider non
 *  suona a vuoto. Il conto lo sapeva già fare `fasceProponibili`, semplicemente
 *  non veniva rifatto dopo lo spostamento.
 *
 *  Le tre risposte possibili, e perché servono tutte e tre:
 *
 *  - **tiene**: la riconsegna fissata va ancora bene. È il caso normale quando
 *    si sposta il ritiro di poche ore, e non va toccata — una data comunicata
 *    al cliente non si cambia senza motivo.
 *  - **sposta**: non regge più, ma c'è una fascia buona. Si prende la prima
 *    utile, che è la meno peggio per chi aspetta il bucato.
 *  - **libera**: non regge e non c'è alternativa. La riconsegna si toglie e
 *    la riprogramma l'ops. Meglio «da programmare» che una data impossibile:
 *    la prima si vede, la seconda si scopre il giorno stesso.
 *
 *  `archiviata` esiste per il caso che ha fatto nascere questa funzione: una
 *  riconsegna agganciata a una fascia tolta dal calendario ha un orario che a
 *  guardarlo sembra valido, ma quel giorno non ci va nessuno. Va spostata anche
 *  se l'ora tornerebbe. */
export type EsitoRiconsegna<T> =
  | { azione: "tiene" }
  | { azione: "sposta"; fascia: T }
  | { azione: "libera" };

export function riconsegnaDopoSpostamento<T extends FasciaRiconsegna>(
  fasceAttive: T[],
  attuale: { starts_at: string; archiviata: boolean } | null,
  inizioRitiroIso: string,
  turnaroundHours: number,
  finestraGiorni: number = FINESTRA_GIORNI,
): EsitoRiconsegna<T> {
  // Nessuna riconsegna fissata: non c'è niente da rimettere a posto. La
  // programmerà chi di dovere, come già succede.
  if (!attuale) return { azione: "tiene" };

  const soglia = prontoDa(inizioRitiroIso, turnaroundHours).getTime();
  const tetto = soglia + finestraGiorni * 86_400_000;
  const quando = new Date(attuale.starts_at).getTime();
  if (!attuale.archiviata && quando >= soglia && quando <= tetto) return { azione: "tiene" };

  const candidate = fasceProponibili(fasceAttive, inizioRitiroIso, turnaroundHours, finestraGiorni);
  return candidate.length > 0 ? { azione: "sposta", fascia: candidate[0] } : { azione: "libera" };
}

/** Un ordine è «da risistemare» quando è ancora aperto e almeno una delle sue
 *  fasce è stata tolta dal calendario.
 *
 *  Nasce dal 6 settembre: le fasce di lunedì 7 e giovedì 10 erano archiviate e
 *  la riconsegna di un cliente era rimasta sopra a quella di giovedì. Dal
 *  calendario non si vedeva, in prenotazione non compariva, e ogni menù
 *  «sposta» filtra `archived_at is null` — quindi quella riconsegna era
 *  **immobile per costruzione** e nessuna schermata la nominava.
 *
 *  Archiviare una fascia occupata resta permesso: è il requisito («le richieste
 *  dei clienti restano anche se cancello tutto»). Quello che non deve restare
 *  possibile è che nessuno lo sappia.
 *
 *  Gli ordini chiusi non contano: una consegna già fatta su una fascia poi
 *  archiviata è storia, non lavoro arretrato. */
export function daRisistemare(o: {
  aperto: boolean;
  ritiroArchiviato: boolean;
  riconsegnaArchiviata: boolean;
}): boolean {
  return o.aperto && (o.ritiroArchiviato || o.riconsegnaArchiviata);
}
