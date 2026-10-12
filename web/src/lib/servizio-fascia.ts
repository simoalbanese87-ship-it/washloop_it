import type { TipoServizio } from "@/lib/tipo-servizio";

/** Chi può prenotare quale fascia, e dove va il sacco che ci sale sopra.
 *
 *  La regola, decisa il 12 ottobre 2026: **il martedì è lavanderia, il
 *  mercoledì è stiro.** Non è un'etichetta per leggere il calendario, è un
 *  vincolo: nel giorno dello stiro non si prenota un sacco da lavare, perché
 *  quel sacco finirebbe ad Arluno dove non c'è una lavatrice.
 *
 *  I due giorni sono **due servizi separati, non due metà dello stesso**: la
 *  lavanderia stira anche, quindi il lava e stira sta tutto nel martedì — un
 *  sacco solo, lavato e stirato dallo stesso banco. Il mercoledì è della
 *  stireria, e ci sale solo chi fa **solo** stiro.
 *
 *  Modulo puro, senza database: è la regola che si sbaglia in silenzio, e i
 *  test la tengono ferma. */

export type ServizioFascia = "lavanderia" | "stiro";

export function isServizioFascia(v: unknown): v is ServizioFascia {
  return v === "lavanderia" || v === "stiro";
}

export const SERVIZIO_FASCIA_LABEL: Record<ServizioFascia, string> = {
  lavanderia: "Lavanderia",
  stiro: "Stiro",
};

/** Colori: lo stiro ha il viola della stireria, la lavanderia il blu di
 *  sempre. Gli stessi di `tipo-servizio.ts`, così in pannello una cosa sola ha
 *  un colore solo. */
export const SERVIZIO_FASCIA_TONO: Record<ServizioFascia, string> = {
  lavanderia: "bg-blue/10 text-blue",
  stiro: "bg-[#7A4FBF]/12 text-[#7A4FBF]",
};

/** Può questo cliente prenotare questa fascia?
 *
 *  - fascia senza servizio → sì, è una fascia buona per tutti (le riconsegne,
 *    e quelle nate prima che esistesse la stireria);
 *  - fascia **stiro** → solo `solo_stiro`: è il giorno della stireria;
 *  - fascia **lavanderia** → `lava_stira` e `solo_lavanderia`, perché la
 *    lavanderia lava e stira, e quei due sacchi vanno allo stesso banco.
 *
 *  **Il cliente senza servizio compilato conta come lavanderia.** Sono i
 *  clienti storici, quelli che il servizio ce l'hanno da prima che il campo
 *  esistesse: lasciarli fuori dal martedì vorrebbe dire chiudere fuori quasi
 *  tutti, e lasciarli entrare nel mercoledì vorrebbe dire mandare il loro
 *  bucato in una stireria. Se uno di loro passa allo stiro, l'ops gli compila
 *  il servizio: è lo stesso gesto che lo instrada ad Arluno. */
export function fasciaPermessa(
  servizioFascia: string | null | undefined,
  tipoServizioCliente: TipoServizio | null | undefined,
): boolean {
  if (!isServizioFascia(servizioFascia)) return true;
  const cliente = tipoServizioCliente ?? "solo_lavanderia";
  if (servizioFascia === "stiro") return cliente === "solo_stiro";
  return cliente === "solo_lavanderia" || cliente === "lava_stira";
}

/** Perché non la può prenotare: la frase che si mostra quando per quel cliente
 *  non resta nessuna fascia. Dire «nessuna disponibilità» sarebbe falso — le
 *  fasce ci sono, non sono per lui. */
export function perchePiena(tipoServizioCliente: TipoServizio | null | undefined): string {
  if (tipoServizioCliente === "solo_stiro") {
    return "Il tuo servizio è il solo stiro: i ritiri dello stiro sono il mercoledì. Se non vedi date libere, scrivici.";
  }
  return "I ritiri della lavanderia sono il martedì. Se non vedi date libere, scrivici.";
}
