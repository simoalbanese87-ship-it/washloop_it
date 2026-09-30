/** Chi va avvisato che l'abbonamento a termine sta per finire.
 *
 *  Stripe non emette nessun evento per «finisce fra due giorni»:
 *  `customer.subscription.trial_will_end` riguarda solo le prove gratuite. Per
 *  una prova a pagamento l'unico momento utile ce lo dobbiamo cercare da soli,
 *  e questa è la regola che decide quando.
 *
 *  Sta in un modulo suo perché è l'unica parte del cron che può sbagliare in
 *  modo silenzioso: mandare l'avviso troppo presto lo rende inutile, troppo
 *  tardi lo rende una scortesia, e non mandarlo affatto significa che il
 *  cliente si accorge della fine dal servizio che non c'è più. */

export type RigaFine = {
  status: string;
  termina_dopo_settimane: number | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  fine_avviso_inviato_at: string | null;
};

/** La finestra: fra 36 e 60 ore dalla fine. È larga un giorno intero perché il
 *  cron gira una volta sola al giorno: una finestra stretta salterebbe chi
 *  scade poche ore prima o dopo il passaggio. */
const DA_ORE = 36;
const A_ORE = 60;

export function vaAvvisato(r: RigaFine, adessoMs: number): boolean {
  // Solo le prove a termine: un abbonamento normale non finisce, si rinnova.
  if (!r.termina_dopo_settimane) return false;
  // Deve essere ancora in corso e davvero destinato a chiudersi. Se la
  // disdetta non c'è, l'abbonamento si rinnoverebbe: dire «finisce» sarebbe
  // falso, e il problema da risolvere sarebbe un altro.
  if (r.status !== "active") return false;
  if (r.cancel_at_period_end !== true) return false;
  // Una volta sola. Deduplica sulla colonna e non sull'esecuzione: il cron può
  // essere rilanciato a mano, e un secondo avviso identico è rumore.
  if (r.fine_avviso_inviato_at) return false;
  if (!r.current_period_end) return false;

  const mancano = (new Date(r.current_period_end).getTime() - adessoMs) / 3_600_000;
  if (!Number.isFinite(mancano)) return false;
  return mancano >= DA_ORE && mancano <= A_ORE;
}
