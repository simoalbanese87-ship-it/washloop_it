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

/** Le fasce proponibili: quelle che iniziano quando il bucato è pronto, o dopo.
 *  Il confine è incluso — una fascia che apre esattamente all'ora in cui la
 *  lavorazione finisce è buona. */
export function fasceProponibili<T extends FasciaRiconsegna>(
  fasce: T[],
  inizioRitiroIso: string,
  turnaroundHours: number,
): T[] {
  const soglia = prontoDa(inizioRitiroIso, turnaroundHours).getTime();
  return fasce
    .filter((f) => new Date(f.starts_at).getTime() >= soglia)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
