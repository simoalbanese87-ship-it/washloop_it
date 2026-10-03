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
 *  Pura e senza `server-only` apposta: è un cancello, e un cancello va provato
 *  senza database. */

/** Gli stati in cui un abbonamento dà diritto al servizio. */
const ABBONAMENTO_VIVO = ["active", "trialing"];

export type ChiPrenota = {
  /** Stato dell'ultimo abbonamento, `null` se non ne ha mai avuto uno. */
  statoAbbonamento?: string | null;
  /** Cliente a consumo: paga i capi, non il canone. */
  aConsumo?: boolean | null;
};

export function abbonamentoVivo(stato: string | null | undefined): boolean {
  return !!stato && ABBONAMENTO_VIVO.includes(stato);
}

export function puoPrenotare(c: ChiPrenota): boolean {
  return abbonamentoVivo(c.statoAbbonamento) || c.aConsumo === true;
}

/** Perché non può, detto a chi legge e non a chi programma. */
export function perchePuoNonPrenotare(c: ChiPrenota): string | null {
  if (puoPrenotare(c)) return null;
  if (c.statoAbbonamento === "past_due" || c.statoAbbonamento === "unpaid") {
    return "C'è una fattura rimasta aperta: appena è saldata torni a prenotare.";
  }
  return "Serve un abbonamento attivo.";
}
