/** Quale lavanderia riceve un ordine, in una funzione sola e senza database.
 *
 *  Finché la lavanderia era una sola la domanda non esisteva: c'era un ripiego,
 *  «se ce n'è esattamente una usa quella», e bastava. Con la stireria di Arluno
 *  le lavanderie diventano due e quel ripiego, da solo, risponderebbe `null` —
 *  cioè ordini che nascono senza lavanderia e che nel portale del partner non si
 *  vedono. È già successo il 14 settembre, e il sacco è arrivato sul banco
 *  senza comparire in nessuna lista.
 *
 *  L'ordine delle precedenze è questo, e il motivo di ciascuna:
 *
 *  1. **Il servizio a sacco.** Un sacco di solo stiro va alla stireria: non è
 *     una preferenza, è l'unica che quel lavoro lo fa.
 *  2. **La fascia.** Se qualcuno l'ha scelta sullo slot, ha deciso una persona.
 *  3. **L'unica lavanderia generale attiva.** Il ripiego storico, ristretto a
 *     chi non è dedicato a un servizio a sacco: le stirerie non entrano nel
 *     conto, altrimenti averne una basterebbe a spegnere il ripiego per tutti.
 *
 *  Se restano due lavanderie generali attive, torna `null` ed è giusto: a quel
 *  punto la scelta esiste davvero e la fa una persona. */
export function scegliLavanderia(input: {
  /** La lavanderia del servizio a sacco del cliente o dell'ordine. */
  servizio?: string | null;
  /** Quella scritta sulla fascia di ritiro, se c'è. */
  fascia?: string | null;
  /** Le lavanderie attive che non sono dedicate a un servizio a sacco. */
  generali: readonly string[];
}): string | null {
  const servizio = (input.servizio ?? "").trim();
  if (servizio) return servizio;
  const fascia = (input.fascia ?? "").trim();
  if (fascia) return fascia;
  return input.generali.length === 1 ? input.generali[0] : null;
}
