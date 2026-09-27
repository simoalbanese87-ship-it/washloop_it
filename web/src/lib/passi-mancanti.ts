/** Cosa manca a una persona per poter prenotare, e in che ordine.
 *
 *  Il difetto che questo modulo esiste per chiudere
 *  ------------------------------------------------
 *  In app la home sceglieva un messaggio solo, con una catena di `else if`, e
 *  l'indirizzo veniva prima dell'abbonamento. A chi mancavano **entrambi** —
 *  cioè a chiunque si sia registrato e fermato prima di pagare — diceva
 *  «manca solo l'indirizzo: un minuto, e poi puoi prenotare il primo ritiro».
 *
 *  Non è un dettaglio di copy: è una promessa falsa. La persona mette
 *  l'indirizzo, torna, e scopre che deve anche pagare. Nessuno gliel'aveva
 *  detto, e il «ci siamo quasi» di prima si legge come una presa in giro.
 *  Elvira Inglese, iscritta il 27 settembre, è rimasta ferma esattamente lì.
 *
 *  Qui i passi si contano tutti insieme e si dicono tutti insieme. */

export type Passo = "abbonamento" | "indirizzo";

export type StatoPercorso = {
  /** C'è un abbonamento che permette di prenotare. */
  abbonamentoAttivo: boolean;
  /** Almeno un indirizzo salvato. */
  haIndirizzo: boolean;
};

/** I passi che restano, nell'ordine in cui vanno fatti.
 *
 *  L'abbonamento per primo perché è quello che sblocca il servizio: un
 *  indirizzo senza abbonamento non serve a niente, mentre un abbonamento senza
 *  indirizzo è già metà strada e lo si completa in trenta secondi. */
export function passiMancanti(s: StatoPercorso): Passo[] {
  const passi: Passo[] = [];
  if (!s.abbonamentoAttivo) passi.push("abbonamento");
  if (!s.haIndirizzo) passi.push("indirizzo");
  return passi;
}

export const PASSO_TESTO: Record<Passo, { titolo: string; dettaglio: string; azione: string; href: string }> = {
  abbonamento: {
    titolo: "Scegli il piano",
    dettaglio: "È il passo che apre il servizio: senza, il ritiro non si può prenotare.",
    azione: "Scegli il piano →",
    href: "/app/abbonamento",
  },
  indirizzo: {
    titolo: "Dicci dove passiamo",
    dettaglio: "Via, civico, citofono e piano. Un minuto.",
    azione: "Aggiungi indirizzo →",
    href: "/app/indirizzi",
  },
};
