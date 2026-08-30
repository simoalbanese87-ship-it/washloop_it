/** Quali ordini si vedono nel board, dato il periodo scelto.
 *
 *  Sta fuori dal componente perché è la regola che ha fatto sparire un ordine
 *  vero per tre giorni: un ritiro previsto il 24 e mai avvenuto usciva dalla
 *  vista "Oggi" il 25 e non ci rientrava più, mentre la home continuava a
 *  contarlo fra quelli in ritardo. Il numero diceva 1, la pagina 0.
 *
 *  Il board non è un calendario: è la lista di quello che c'è da sistemare. Un
 *  passaggio scaduto e non chiuso ci resta finché qualcuno non lo chiude. */

export type Periodo = "oggi" | "settimana" | "tutti";

export type OrdinePerPeriodo = {
  status: string;
  /** Il giorno del passaggio previsto, YYYY-MM-DD, fuso di Roma. */
  giorno: string;
};

/** Stati in cui non c'è più niente da fare: non sono arretrati, sono finiti. */
const CHIUSI = ["delivered", "completed", "cancelled"];

/** Un passaggio previsto per un giorno già passato e ancora da chiudere. */
export function arretrato(o: OrdinePerPeriodo, oggi: string): boolean {
  if (CHIUSI.includes(o.status)) return false;
  return o.giorno < oggi;
}

/** Se l'ordine va mostrato con il periodo scelto. Gli arretrati passano sempre,
 *  qualunque sia il periodo: sono il motivo per cui si guarda il board. */
export function passaPeriodo(
  o: OrdinePerPeriodo,
  periodo: Periodo,
  oggi: string,
  fineSettimana: string,
): boolean {
  if (periodo === "tutti") return true;
  // `oggi` vuoto = la pagina non si è ancora idratata: non si filtra niente,
  // altrimenti il primo render sarebbe un board vuoto.
  if (!oggi) return true;
  if (arretrato(o, oggi)) return true;
  if (periodo === "oggi") return o.giorno === oggi;
  return o.giorno >= oggi && o.giorno <= fineSettimana;
}

/** L'ordine con cui le card compaiono in colonna.
 *
 *  Prima erano ordinate solo per "in ritardo sì/no", e a parità restavano
 *  nell'ordine con cui arrivano dal database — dal più recente creato. In
 *  colonna si leggeva 9 set, 23 set, 23 set, 14 set, 2 set: per capire cosa
 *  ritirare domani bisognava leggerle tutte.
 *
 *  Ora comanda il passaggio previsto, dal più vicino al più lontano. Chi è già
 *  in ritardo resta in cima: è quello su cui bisogna agire adesso. */
export function confrontaUrgenza(
  a: { ritardo: boolean; quando: string },
  b: { ritardo: boolean; quando: string },
): number {
  if (a.ritardo !== b.ritardo) return a.ritardo ? -1 : 1;
  return new Date(a.quando).getTime() - new Date(b.quando).getTime();
}
