/** Fino a quando il cliente può cambiare idea su un ritiro.
 *
 *  Il problema che risolve
 *  -----------------------
 *  Fino al 31 ottobre 2026 non c'era nessuna scadenza: si spostava o si
 *  disdiceva **finché il sacco non era stato ritirato**, cioè fino al momento
 *  in cui il rider lo segnava preso. Anche mezz'ora prima del giro.
 *
 *  Per chi disdice è comodo; per chi guida no. Un buco aperto alle 07:50 su un
 *  giro delle 08:00 non lo riempie più nessuno: il furgone parte lo stesso, il
 *  rider fa la strada lo stesso, e quel posto resta vuoto mentre magari c'era
 *  qualcun altro che lo voleva.
 *
 *  Ventiquattro ore sono il tempo che serve a rimettere a posto un giro.
 *
 *  Non è un muro
 *  -------------
 *  Dopo la scadenza il cliente non resta solo: gli si dice di scriverci, e
 *  **dal pannello si fa tutto lo stesso**. La regola serve a far arrivare la
 *  richiesta a una persona, non a dire di no.
 *
 *  Modulo puro e senza dipendenze: decide cosa un cliente può ancora fare, e
 *  i test lo tengono fermo. */

/** Quanto prima del ritiro ci si può ancora muovere. */
export const ORE_PER_CAMBIARE = 24;

/** L'istante oltre il quale non si tocca più. `null` se il ritiro non ha
 *  ancora una fascia: senza una data non c'è nessuna scadenza da far valere. */
export function scadenzaCambio(inizioRitiroIso: string | null | undefined): string | null {
  if (!inizioRitiroIso) return null;
  const inizio = Date.parse(inizioRitiroIso);
  if (Number.isNaN(inizio)) return null;
  return new Date(inizio - ORE_PER_CAMBIARE * 3_600_000).toISOString();
}

/** Si può ancora spostare o disdire?
 *
 *  Senza fascia si può: è il caso dei pochi ordini nati a mano, e negare per
 *  un dato che manca sarebbe una penalità al cliente per un difetto nostro. */
export function siPuoAncoraCambiare(
  inizioRitiroIso: string | null | undefined,
  ora: Date = new Date(),
): boolean {
  const scadenza = scadenzaCambio(inizioRitiroIso);
  if (!scadenza) return true;
  return ora.getTime() < Date.parse(scadenza);
}

/** La scadenza detta a chi legge: «entro domenica 1 novembre alle 08:00». */
export function scadenzaDetta(inizioRitiroIso: string | null | undefined): string | null {
  const scadenza = scadenzaCambio(inizioRitiroIso);
  if (!scadenza) return null;
  const d = new Date(scadenza);
  const giorno = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  const ora = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return `${giorno} alle ${ora}`;
}
