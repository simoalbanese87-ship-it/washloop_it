/** Il mese, in ora di Roma.
 *
 *  Sta in un file suo e senza `server-only` apposta: decide a quale mese
 *  appartiene un incasso, e una regola del genere va provata senza database.
 *  Il bordo di un mese è il posto dove sbagliano tutti — mezzanotte UTC in
 *  Italia sono le due del mattino, e due ore di incassi finiscono nel mese
 *  prima senza che nessuno se ne accorga mai. */

/** Chiave `YYYY-MM` in ora di Roma.
 *
 *  In ora di Roma e non UTC: chi paga alle 00:30 del 1° novembre, in UTC è
 *  ancora il 31 ottobre, e quell'incasso finirebbe nel mese sbagliato. */
export function meseRoma(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" })
    .format(new Date(iso))
    .slice(0, 7);
}

/** Il mese in corso, in ora di Roma. */
export function meseCorrente(ora: Date = new Date()): string {
  return meseRoma(ora);
}

/** Inizio e fine di un mese `YYYY-MM`, come istanti.
 *
 *  Gli estremi si costruiscono dall'ora di Roma e non da `Date.UTC`: per due
 *  ore ogni notte il giorno italiano e quello UTC non coincidono, e un mese
 *  che comincia alle 00:00 UTC comincia alle 02:00 italiane — due ore di
 *  incassi assegnate al mese prima. */
export function confiniMeseRoma(chiave: string): { dalIso: string; alIso: string } {
  const [anno, mese] = chiave.split("-").map(Number);
  const dopo = mese === 12 ? `${anno + 1}-01` : `${anno}-${String(mese + 1).padStart(2, "0")}`;
  return { dalIso: mezzanotteRoma(`${chiave}-01`), alIso: mezzanotteRoma(`${dopo}-01`) };
}

/** L'istante in cui comincia un giorno italiano.
 *
 *  Si parte dallo stesso istante letto come se fosse UTC e si toglie lo scarto
 *  che Roma aveva in quel momento: due passaggi invece di una tabella di fusi,
 *  e l'ora legale la decide il sistema operativo, non noi.
 *
 *  Scritta qui e non presa da `format.ts` perché questo file non deve
 *  dipendere da nient'altro: è il modulo che i test caricano da soli. */
function mezzanotteRoma(giorno: string): string {
  const comeUtc = new Date(`${giorno}T00:00:00.000Z`);
  const parti = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(comeUtc)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  const scarto =
    Date.UTC(+parti.year, +parti.month - 1, +parti.day, +parti.hour, +parti.minute, +parti.second) - comeUtc.getTime();
  return new Date(comeUtc.getTime() - scarto).toISOString();
}
