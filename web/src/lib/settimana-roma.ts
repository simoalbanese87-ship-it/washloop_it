/** La settimana, in ora di Roma.
 *
 *  Il problema che risolve
 *  -----------------------
 *  «Un ritiro a settimana» è la regola del servizio da sempre, e fino al 31
 *  ottobre 2026 non era scritta da nessuna parte. Reggeva per conto suo: la
 *  lavanderia ha un giorno solo, il martedì, e due ritiri in sette giorni sono
 *  fisicamente impossibili. Lo stiro invece ne ha due — lunedì e mercoledì — e
 *  lì nessuno fermava chi li prenotava entrambi.
 *
 *  La settimana va da **lunedì a domenica**: sono le «quattro settimane del
 *  mese» di cui si parla al telefono, non la settimana americana che comincia
 *  di domenica.
 *
 *  Perché in ora di Roma
 *  ---------------------
 *  Un ritiro del lunedì alle 08:00 italiane, in UTC, d'estate è il lunedì alle
 *  06:00 — stessa settimana. Ma un ordine creato la domenica sera alle 23:30
 *  italiane in UTC è ancora domenica alle 21:30, e uno delle 00:30 di lunedì è
 *  domenica alle 23:30: contando in UTC finirebbe nella settimana prima, e il
 *  cliente si sentirebbe dire di no su una settimana in cui non ha niente.
 *
 *  Modulo puro e senza dipendenze, come `mese-roma.ts`: decide se una persona
 *  che paga può prenotare, e i test lo caricano da soli. */

const GIORNI: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** La chiave della settimana: il **lunedì** che la apre, in forma `2026-11-09`.
 *
 *  Una data e non un numero di settimana ISO: `2026-W45` non si legge, e nei
 *  messaggi al cliente la data serve comunque. */
export function settimanaRoma(iso: string | Date): string {
  const parti = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});

  // Da qui in poi è aritmetica di calendario su una data già italiana: niente
  // fusi, niente ore. Il cambio dell'ora legale non sposta nessun giorno.
  const giorno = Date.UTC(+parti.year, +parti.month - 1, +parti.day);
  const quale = GIORNI[parti.weekday] ?? 1;
  const lunedi = new Date(giorno - (quale - 1) * 86_400_000);
  return lunedi.toISOString().slice(0, 10);
}

/** Questa data cade in una settimana già occupata? */
export function settimanaOccupata(settimane: Iterable<string>, quandoIso: string | Date): boolean {
  const k = settimanaRoma(quandoIso);
  for (const s of settimane) if (s === k) return true;
  return false;
}

/** «lunedì 3 novembre», per dire al cliente quale ritiro ha già.
 *
 *  Sta qui e non nelle pagine perché la frase è una sola e la dicono in tre
 *  posti: l'azione che rifiuta, la pagina che nasconde i giorni e lo
 *  spostamento. Tre copie sarebbero tre modi di scrivere la stessa data. */
export function giornoEsteso(iso: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}
