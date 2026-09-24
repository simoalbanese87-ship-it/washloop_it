/** Le regole sulle note delle persone, senza database.
 *
 *  Stanno qui e non dentro le action perché sono le tre decisioni che si
 *  possono sbagliare in silenzio: quando una nota è «vuota» (e va cancellata
 *  invece che salvata), come si accorcia in tabella, e a chi appartiene. */

/** La lunghezza massima. Non è un limite tecnico: è il punto oltre il quale una
 *  nota smette di essere «cosa ci siamo detti» e diventa un documento, che in
 *  una cella di tabella non si legge comunque. */
export const NOTA_MAX = 2000;

/** Il testo così come va salvato, oppure `null` se non c'è niente da salvare.
 *
 *  `null` e stringa vuota non sono la stessa cosa a valle: `null` significa
 *  «cancella la riga», "" significa «salva una nota vuota», e salvare una nota
 *  vuota lascia in giro righe che poi qualcuno deve capire. La condizione era
 *  scritta in due punti diversi; qui è una sola, e ha i test. */
export function normalizzaNota(grezzo: string | null | undefined): string | null {
  const t = (grezzo ?? "").trim();
  if (!t) return null;
  return t.length > NOTA_MAX ? t.slice(0, NOTA_MAX).trimEnd() : t;
}

/** L'anteprima in tabella: si taglia sulla parola, non a metà.
 *
 *  I puntini compaiono solo se il taglio è avvenuto davvero — altrimenti dicono
 *  «c'è dell'altro» su una nota che è già tutta lì. */
export function anteprimaNota(nota: string | null | undefined, max = 90): string {
  const t = (nota ?? "").trim().replace(/\s+/g, " ");
  if (!t || t.length <= max) return t;
  const taglio = t.slice(0, max);
  const spazio = taglio.lastIndexOf(" ");
  return (spazio > max * 0.6 ? taglio.slice(0, spazio) : taglio).trimEnd() + "…";
}

export type DestinazioneNota = "cliente" | "lead" | "ambigua" | "mancante";

/** A chi appartiene la nota.
 *
 *  In Persone una riga è un profilo **oppure** un lead, mai entrambi. È un
 *  invariante che finora stava implicito nelle form; qui è esplicito, così chi
 *  scrive può rifiutare i due casi storti invece di sceglierne uno a caso —
 *  che vorrebbe dire scrivere la nota su una persona e mostrarla su un'altra. */
export function destinazioneNota(args: { profileId?: string | null; leadId?: string | null }): DestinazioneNota {
  const p = (args.profileId ?? "").trim();
  const l = (args.leadId ?? "").trim();
  if (p && l) return "ambigua";
  if (p) return "cliente";
  if (l) return "lead";
  return "mancante";
}
