/** Quanti ritiri comprati restano a un cliente.
 *
 *  Il problema che risolve
 *  -----------------------
 *  Si vende «un ritiro» a chi non vuole un abbonamento, e fino a ieri di quel
 *  ritiro comprato non restava traccia: i soldi entravano, il permesso di
 *  prenotare era un flag senza limite, e la seconda prenotazione era gratis.
 *
 *  Un gettone è un ritiro completo — andata e riconsegna — e **non scade**: si
 *  consuma quando il cliente prenota, non quando riceve il sacco.
 *
 *  Il saldo è una differenza, non una casella
 *  ------------------------------------------
 *  Accreditati meno usati, dove gli usati sono gli ordini: un contatore scritto
 *  a parte diverge dal reale al primo ordine annullato in pannello. Così invece
 *  l'annullo restituisce il gettone da solo, perché l'ordine smette di contare.
 *
 *  Modulo puro con i test: decide se una persona che ha pagato può prenotare,
 *  e si sbaglia in silenzio. */

export type ContoGettoni = {
  /** Quanti ne ha comprati o ricevuti in tutto. */
  accreditati: number;
  /** Quanti ritiri non annullati li hanno consumati. */
  usati: number;
  /** Quanti ne restano. Mai negativo: quello che sfora sta in `oltre`. */
  residui: number;
  /** Quanti ritiri ha fatto oltre i gettoni che aveva. Non è un errore da
   *  bloccare a posteriori: è il numero da cui parte una telefonata. */
  oltre: number;
};

export function contoGettoni(input: { accreditati?: number | null; usati?: number | null }): ContoGettoni {
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
 *  perché i gettoni non c'entrano con il loro modo di essere clienti. */
export function fraseGettoni(c: ContoGettoni): string | null {
  if (c.accreditati === 0) return null;
  if (c.residui === 0) return "Hai usato tutti i ritiri che hai comprato.";
  return c.residui === 1 ? "Ti resta 1 ritiro." : `Ti restano ${c.residui} ritiri.`;
}
