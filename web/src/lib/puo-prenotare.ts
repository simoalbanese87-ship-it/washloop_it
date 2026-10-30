/** Chi può aprire un ritiro, e perché.
 *
 *  Finora la regola era una sola riga ripetuta in quattro punti: «stato
 *  dell'abbonamento fra active e trialing». Giusta finché l'unico modo di
 *  essere clienti era l'abbonamento.
 *
 *  Dal 3 ottobre 2026 c'è anche il cliente **a consumo**: niente canone, niente
 *  capi compresi, paga a listino quello che lascia nel sacco. Deve poter
 *  prenotare come gli altri — «quando vuole», parole di Simone — e il permesso
 *  è un flag sul profilo, non una deduzione.
 *
 *  Perché un flag e non «non ha un abbonamento»: anche chi se n'è andato non ha
 *  un abbonamento, e a quello il ritiro non lo si vuole lasciar prenotare. La
 *  differenza fra un cliente a consumo e un ex cliente non sta nei dati, sta in
 *  un accordo — e gli accordi si scrivono.
 *
 *  Dal 30 ottobre 2026 il cancello conta
 *  -------------------------------------
 *  Finché diceva solo sì o no, chi comprava **un** ritiro ne prenotava tre:
 *  dentro la settimana pagata l'abbonamento era vivo, e vivo era l'unica cosa
 *  che si guardasse. Adesso il permesso ha anche una quantità — i ritiri
 *  comprati — e chi li ha finiti è fermo come chi non ne ha mai avuti, ma non
 *  si sente dire la stessa cosa.
 *
 *  **I ritiri non scadono.** Non appartengono a un periodo: chi ne compra uno e
 *  lo usa fra due mesi ha comprato lo stesso lavoro. Per questo qui non c'è
 *  nessuna data: il tempo non toglie niente a nessuno.
 *
 *  Due modi di avere diritto, e non si confondono: chi paga un canone a cadenza
 *  libera prenota perché l'abbonamento è vivo — sono tutti quelli storici, e
 *  per loro non è cambiato niente; chi ha comprato un numero di ritiri, in
 *  blocco o a ogni rinnovo, prenota finché ne ha.
 *
 *  Pura e senza `server-only` apposta: è un cancello, e un cancello va provato
 *  senza database. */

/** Gli stati in cui un abbonamento dà diritto al servizio. */
const ABBONAMENTO_VIVO = ["active", "trialing"];

export type ChiPrenota = {
  /** Stato dell'ultimo abbonamento, `null` se non ne ha mai avuto uno. */
  statoAbbonamento?: string | null;
  /** Cliente a consumo: paga i capi, non il canone. */
  aConsumo?: boolean | null;
  /** Ritiri comprati e non ancora usati. Non scadono e valgono anche senza
   *  abbonamento: sono lavori già pagati. */
  ritiri?: number | null;
  /** Quanti ne ha avuti in tutto, usati compresi. Serve solo a dire la frase
   *  giusta a chi li ha finiti. */
  ritiriAccreditati?: number | null;
  /** L'abbonamento dà un numero di ritiri a ogni rinnovo invece del servizio a
   *  cadenza libera. Per questi il permesso lo danno i ritiri, non lo stato. */
  abbonamentoARitiri?: boolean | null;
};

export function abbonamentoVivo(stato: string | null | undefined): boolean {
  return !!stato && ABBONAMENTO_VIVO.includes(stato);
}

const quanti = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

/** L'abbonamento da solo basta a prenotare: è vivo e non è di quelli che danno
 *  un numero di ritiri. */
export function canoneACadenzaLibera(c: ChiPrenota): boolean {
  return abbonamentoVivo(c.statoAbbonamento) && c.abbonamentoARitiri !== true;
}

export function puoPrenotare(c: ChiPrenota): boolean {
  if (quanti(c.ritiri) > 0) return true;
  if (canoneACadenzaLibera(c)) return true;
  return c.aConsumo === true;
}

/** Perché non può, detto a chi legge e non a chi programma. */
export function perchePuoNonPrenotare(c: ChiPrenota): string | null {
  if (puoPrenotare(c)) return null;
  if (c.statoAbbonamento === "past_due" || c.statoAbbonamento === "unpaid") {
    return "C'è una fattura rimasta aperta: appena è saldata torni a prenotare.";
  }
  // Chi ha appena finito non è chi non ha mai cominciato: la frase che vede
  // deve dirgli che cosa è successo, non ricominciare da capo.
  if (abbonamentoVivo(c.statoAbbonamento) && c.abbonamentoARitiri === true) {
    return "Hai usato tutti i ritiri che avevi: al prossimo rinnovo te ne arrivano altri.";
  }
  if (quanti(c.ritiriAccreditati) > 0) {
    return "Hai usato tutti i ritiri che hai comprato: comprane un altro o passa all'abbonamento.";
  }
  return "Serve un abbonamento attivo.";
}
