/** L'IVA, in un posto solo.
 *
 *  Le due direzioni servono entrambe, e confonderle costa soldi veri:
 *
 *  - **Verso il cliente** gli importi sono IVA inclusa: il prezzo a listino è
 *    quello che paga su Stripe. Per fatturare si SCORPORA.
 *  - **Verso la lavanderia** gli importi sono IVA esclusa: il listino del
 *    contratto ha una colonna apposta («Prezzo iva esclusa per calcolo
 *    lavanderia»), ed è quella che il database memorizza. Sul proforma l'IVA si
 *    AGGIUNGE.
 *
 *  Il 4 settembre 2026 avevo trattato il dovuto alla lavanderia come ivato e
 *  scorporato: sbagliato, e il file del contratto lo dice a chiare lettere.
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

/** Da un imponibile ricava imposta e totale. La direzione opposta a
 *  `scorpora`: si usa verso i fornitori, che fatturano imponibile + IVA. */
export function aggiungiIva(imponibileCents: number, aliquota: number = ALIQUOTA_IVA): Scorporo {
  const imponibile = Math.round(imponibileCents);
  const lordo = Math.round(imponibile * (1 + aliquota / 100));
  return { imponibile, iva: lordo - imponibile, lordo };
}
