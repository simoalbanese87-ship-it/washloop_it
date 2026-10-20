/** Che servizio fa quel cliente: lava e stira, solo stiro, solo lavanderia.
 *
 *  Non si deduce da nessun dato che abbiamo — un abbonamento Small non dice se
 *  quella persona ci manda camicie da stirare o bucato da lavare. Lo sa chi
 *  parla con i clienti, e lo scrive a mano dal pannello. Per questo il valore
 *  di partenza è vuoto e resta vuoto finché qualcuno non lo compila: un
 *  «lava-stira» messo di default sarebbe una riga di dati inventata, e da lì
 *  partirebbero email sbagliate.
 *
 *  Serve a due cose: leggere il CRM, e decidere la lista di Brevo — «solo
 *  stiro» è un cluster a sé, con le sue email. */

export const TIPI_SERVIZIO = ["lava_stira", "solo_stiro", "solo_lavanderia"] as const;
export type TipoServizio = (typeof TIPI_SERVIZIO)[number];

export const TIPO_SERVIZIO_LABEL: Record<TipoServizio, string> = {
  lava_stira: "Lava e stira",
  solo_stiro: "Solo stiro",
  solo_lavanderia: "Solo lavanderia",
};

/** Il vuoto ha un'etichetta sua: «da compilare» dice che manca un'informazione,
 *  mentre un trattino sembrerebbe un dato che non esiste. */
export const TIPO_SERVIZIO_VUOTO = "Da compilare";

/** Un colore per servizio, e nessuno in comune con gli altri chip della stessa
 *  riga. «Solo stiro» era ambra come «Da contattare» (`lead-status.ts`), e in
 *  tabella i due stanno a due colonne di distanza: si leggevano come la stessa
 *  cosa. Ora è viola, che non ha nessun altro — e il solo stiro è il servizio
 *  che va in una lavanderia diversa, quindi è proprio quello da riconoscere
 *  senza leggere. */
export const TIPO_SERVIZIO_TONO: Record<TipoServizio, string> = {
  lava_stira: "bg-blue/10 text-blue",
  solo_stiro: "bg-[#7A4FBF]/12 text-[#7A4FBF]",
  solo_lavanderia: "bg-[#1F8A5B]/12 text-[#1F8A5B]",
};

export function isTipoServizio(v: unknown): v is TipoServizio {
  return typeof v === "string" && (TIPI_SERVIZIO as readonly string[]).includes(v);
}

/** Dal valore grezzo di un form al valore da scrivere: la stringa vuota torna
 *  `null`, perché «nessuna scelta» è un valore legittimo e non un errore. */
export function tipoServizioDaForm(v: unknown): TipoServizio | null {
  if (v === "" || v == null) return null;
  return isTipoServizio(v) ? v : null;
}

/** Il servizio che fa una sede, detto con le parole del cliente.
 *
 *  Lato rider il servizio non si legge in anagrafica: si deduce da **dove va
 *  quel sacco**, cioè dalla lavanderia dell'ordine (`lavanderia.ts`, che
 *  risponde `"lavanderia" | "stiro"`). Sono due nomi per lo stesso fatto, e
 *  finché erano due anche le etichette e i colori il rider vedeva ambra dove
 *  l'ops vedeva viola — con l'aggravante che nell'app del rider l'ambra
 *  significa già «in ritardo».
 *
 *  Qui si traduce, una volta sola, così che etichetta e colore restino quelli
 *  di `TIPO_SERVIZIO_LABEL` e `TIPO_SERVIZIO_TONO`: una cosa da ricordare
 *  invece di due.
 *
 *  La sede generale fa lavaggio **e** stiro — «lavanderia» è il nome del posto,
 *  non del servizio — quindi diventa `lava_stira` e non `solo_lavanderia`. */
export function tipoServizioDellaSede(servizio: "lavanderia" | "stiro" | null | undefined): TipoServizio | null {
  if (servizio === "stiro") return "solo_stiro";
  if (servizio === "lavanderia") return "lava_stira";
  return null;
}
