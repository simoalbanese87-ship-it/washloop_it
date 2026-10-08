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

export const TIPO_SERVIZIO_TONO: Record<TipoServizio, string> = {
  lava_stira: "bg-blue/10 text-blue",
  solo_stiro: "bg-[#C9881F]/12 text-[#C9881F]",
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
