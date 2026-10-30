/** Quanti ritiri comprati restano a un cliente.
 *
 *  Il problema che risolve
 *  -----------------------
 *  Si vende «un ritiro» a chi non vuole un abbonamento, e fino al 30 ottobre
 *  di quel ritiro comprato non restava traccia: i soldi entravano, il permesso
 *  di prenotare era un flag senza limite, e la seconda prenotazione era gratis.
 *
 *  Un ritiro comprato è un lavoro completo — andata e riconsegna — e **non
 *  scade**: si consuma quando il cliente prenota, non quando riceve il sacco.
 *  «Un ritiro = una settimana» è il modo normale di raccontarlo al telefono,
 *  non una regola che il programma fa rispettare: chi ne compra uno e lo usa
 *  fra due mesi ha comprato lo stesso lavoro.
 *
 *  Il saldo è una differenza, non una casella
 *  ------------------------------------------
 *  Accreditati meno usati, dove gli usati sono gli ordini: un contatore scritto
 *  a parte diverge dal reale al primo ordine annullato in pannello. Così invece
 *  l'annullo restituisce il ritiro da solo, perché l'ordine smette di contare.
 *
 *  Modulo puro con i test: decide se una persona che ha pagato può prenotare,
 *  e si sbaglia in silenzio. */

export type ContoRitiri = {
  /** Quanti ne ha comprati o ricevuti in tutto. */
  accreditati: number;
  /** Quanti ordini non annullati li hanno consumati. */
  usati: number;
  /** Quanti ne restano. Mai negativo: quello che sfora sta in `oltre`. */
  residui: number;
  /** Quanti ritiri ha fatto oltre quelli che aveva. Non è un errore da
   *  bloccare a posteriori: è il numero da cui parte una telefonata. */
  oltre: number;
};

export function contoRitiri(input: { accreditati?: number | null; usati?: number | null }): ContoRitiri {
  const accreditati = Math.max(0, Math.trunc(input.accreditati || 0));
  const usati = Math.max(0, Math.trunc(input.usati || 0));
  return {
    accreditati,
    usati,
    residui: Math.max(0, accreditati - usati),
    oltre: Math.max(0, usati - accreditati),
  };
}

/** Il saldo detto a chi legge.
 *
 *  `null` per chi non ha mai comprato un ritiro: a quelli non si dice niente,
 *  perché i ritiri comprati non c'entrano con il loro modo di essere clienti. */
export function fraseRitiri(c: ContoRitiri): string | null {
  if (c.accreditati === 0) return null;
  if (c.residui === 0) return "Ha usato tutti i ritiri che ha.";
  return c.residui === 1 ? "Gli resta 1 ritiro." : `Gli restano ${c.residui} ritiri.`;
}
