/** Quante unità di un capo si addebitano davvero, tolta la franchigia.
 *
 *  «Ogni sacchetto contiene fino a 3 camicie» è parte dell'offerta che il
 *  cliente compra, e per giorni è vissuta solo come frase su un modulo: la
 *  lavanderia doveva ricordarsene e fare la sottrazione a mente. Il risultato è
 *  che, guardando un addebito, non si poteva sapere se fosse giusto — perché
 *  non era registrato quante camicie ci fossero, solo quante ne erano state
 *  messe in conto.
 *
 *  Qui la sottrazione la fa la macchina, sempre allo stesso modo. Funzione pura
 *  e testata: decide quanto paga una persona, e va potuta collaudare senza
 *  database.
 */

export type ContoFranchigia = {
  /** Quante se ne addebitano. */
  daAddebitare: number;
  /** Quante ne assorbe l'abbonamento in questa registrazione. */
  incluse: number;
  /** La franchigia totale dell'ordine, per spiegarla a chi legge. */
  franchigiaTotale: number;
};

/** @param trovate      quante ce n'erano in questo sacco
 *  @param inclusePerSacco  franchigia per sacco (3 per la camicia, 0 altrove)
 *  @param sacchi       quanti sacchi ha l'ordine
 *  @param giaConteggiate  unità dello stesso capo già registrate sull'ordine,
 *                         totali (non solo quelle addebitate): senza, due
 *                         registrazioni separate userebbero la franchigia due
 *                         volte e il cliente non pagherebbe mai il surplus. */
export function conteggiaConFranchigia(
  trovate: number,
  inclusePerSacco: number,
  sacchi: number,
  giaConteggiate = 0,
): ContoFranchigia {
  const n = Math.max(0, Math.trunc(trovate));
  const franchigiaTotale = Math.max(0, Math.trunc(inclusePerSacco)) * Math.max(1, Math.trunc(sacchi));
  if (franchigiaTotale === 0) return { daAddebitare: n, incluse: 0, franchigiaTotale: 0 };

  const residua = Math.max(0, franchigiaTotale - Math.max(0, Math.trunc(giaConteggiate)));
  const incluse = Math.min(n, residua);
  return { daAddebitare: n - incluse, incluse, franchigiaTotale };
}
