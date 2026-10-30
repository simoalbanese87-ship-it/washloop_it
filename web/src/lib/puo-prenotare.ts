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
 *  che si guardasse. Adesso il permesso ha anche una quantità — i gettoni
 *  comprati, o i passaggi compresi nel periodo — e un cliente che li ha finiti
 *  è fermo come chi non ne ha mai avuti, ma non si sente dire la stessa cosa.
 *
 *  Chi non ha nessun tetto resta senza tetto: è il caso di tutti gli
 *  abbonamenti storici, e non si inventa un limite a chi non l'ha comprato.
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
  /** Ritiri comprati e non ancora usati. I gettoni non scadono e non
   *  appartengono a un ciclo: valgono anche senza abbonamento. */
  gettoni?: number | null;
  /** Quanti ne ha comprati in tutto, usati compresi. Serve solo a dire la
   *  frase giusta a chi li ha finiti. */
  gettoniAccreditati?: number | null;
  /** Passaggi che restano nel periodo pagato. `null` = nessun tetto, ed è il
   *  comportamento storico. */
  residuiPassaggi?: number | null;
};

export function abbonamentoVivo(stato: string | null | undefined): boolean {
  return !!stato && ABBONAMENTO_VIVO.includes(stato);
}

const quanti = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

/** Il tetto del periodo è esaurito: c'è un numero, ed è a zero. */
function tettoFinito(c: ChiPrenota): boolean {
  return typeof c.residuiPassaggi === "number" && Number.isFinite(c.residuiPassaggi) && c.residuiPassaggi <= 0;
}

export function puoPrenotare(c: ChiPrenota): boolean {
  // I gettoni comprati valgono sempre, e valgono per primi: sono ritiri già
  // pagati, e restano dovuti anche a chi nel frattempo ha disdetto.
  if (quanti(c.gettoni) > 0) return true;
  if (abbonamentoVivo(c.statoAbbonamento)) return !tettoFinito(c);
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
  if (abbonamentoVivo(c.statoAbbonamento) && tettoFinito(c)) {
    return "Hai usato tutti i ritiri compresi in questo periodo: dal rinnovo torni a prenotare.";
  }
  if (quanti(c.gettoniAccreditati) > 0) {
    return "Hai usato tutti i ritiri che hai comprato: comprane un altro o passa all'abbonamento.";
  }
  return "Serve un abbonamento attivo.";
}
