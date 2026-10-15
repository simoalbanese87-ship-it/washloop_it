/** Di quanto è cresciuto un numero rispetto a quello di prima.
 *
 *  Nasce per il grafico degli incassi: dodici colonne in fila dicevano quanto
 *  abbiamo incassato, ma non **se stiamo crescendo** — e quella è la domanda
 *  per cui uno apre la Home il lunedì mattina.
 *
 *  Il caso che fa sbagliare è il mese a zero. Da zero non si cresce di una
 *  percentuale: qualunque numero diviso zero è infinito, e «+∞%» o «+100%» su
 *  un pannello sono due modi diversi di scrivere una cosa che non si sa. Qui si
 *  risponde `null`, e chi mostra il numero scrive niente invece di inventare.
 *
 *  Modulo puro con i test: è una divisione, e le divisioni con lo zero dentro
 *  sono esattamente quelle che passano i mesi a dire bugie. */

/** La variazione da `prima` a `adesso`, in percentuale intera.
 *
 *  `null` quando non c'è un confronto possibile: niente mese precedente, o un
 *  mese precedente a zero. Negativo quando si scende. */
export function variazionePercentuale(adesso: number, prima: number | null | undefined): number | null {
  if (prima == null || !Number.isFinite(prima) || prima <= 0) return null;
  if (!Number.isFinite(adesso)) return null;
  return Math.round(((adesso - prima) / prima) * 100);
}

/** Come si scrive quella variazione accanto a una colonna.
 *
 *  Sotto l'1% si scrive `=`: un mese che chiude a 601 € contro 600 € non è
 *  cresciuto dell'1%, è lo stesso mese — e una freccia verde su quel numero
 *  farebbe festeggiare un arrotondamento. */
export function etichettaVariazione(pct: number | null): { testo: string; verso: "su" | "giu" | "pari" } | null {
  if (pct == null) return null;
  if (Math.abs(pct) < 1) return { testo: "=", verso: "pari" };
  return { testo: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`, verso: pct > 0 ? "su" : "giu" };
}
