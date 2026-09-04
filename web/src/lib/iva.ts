/** Lo scorporo dell'IVA, in un posto solo.
 *
 *  Gli importi che questo sistema maneggia sono **IVA inclusa**: il prezzo che
 *  il cliente vede e paga su Stripe, e il compenso concordato con la lavanderia
 *  («15 € a sacco» detto da Simone il 4 settembre 2026 vuol dire quindici euro
 *  in tutto, non quindici più IVA). L'imponibile non si memorizza: si ricava
 *  quando serve, cioè quando si emette un documento.
 *
 *  Il conto stava già dentro `fatturazione.ts` come `amountCents / 1.22` scritto
 *  a mano. Metterlo qui evita che la terza copia diverga dalle prime due, e
 *  permette di collaudarlo: un arrotondamento sbagliato su un proforma è un
 *  fornitore che ti scrive.
 */

export const ALIQUOTA_IVA = 22;

export type Scorporo = {
  /** Base imponibile, in centesimi. */
  imponibile: number;
  /** IVA, in centesimi. */
  iva: number;
  /** Il totale di partenza, invariato. */
  lordo: number;
};

/** Da un importo IVA inclusa ricava imponibile e imposta.
 *
 *  L'imponibile si arrotonda e l'IVA si ricava per differenza, mai
 *  arrotondandola a sua volta: così imponibile + IVA fa **sempre** esattamente
 *  il lordo di partenza. Arrotondando le due voci separatamente, su certi
 *  importi la somma sbaglia di un centesimo — e un proforma che non quadra con
 *  la cifra concordata è un proforma che torna indietro. */
export function scorpora(lordoCents: number, aliquota: number = ALIQUOTA_IVA): Scorporo {
  const lordo = Math.round(lordoCents);
  const imponibile = Math.round(lordo / (1 + aliquota / 100));
  return { imponibile, iva: lordo - imponibile, lordo };
}
