import type { TipoServizio } from "@/lib/tipo-servizio";

/** Quante ore servono per lavorare un sacco, e perché non è un numero solo.
 *
 *  Lavare, asciugare, stirare e piegare un sacco di bucato prende tre giorni.
 *  **Stirare e basta ne prende due**: non c'è nessuna lavatrice da aspettare,
 *  e la stireria di Arluno lavora su quel passo.
 *
 *  Finché il servizio era uno, 72 ore stavano scritte in un posto solo e
 *  andavano bene. Dal 12 ottobre 2026 non più: il solo stiro si vende con un
 *  abbonamento su misura, che **non ha un piano di listino collegato**, quindi
 *  cadeva sul ripiego di 72 ore. Valeria ha letto «ci servono 72 ore» e la
 *  prima riconsegna che l'app le offriva era venerdì **23** invece del 16.
 *
 *  Modulo puro, senza database: ci passano l'ora di pronto scritta sull'ordine,
 *  le fasce di riconsegna che il cliente vede e la frase che legge. Sbagliarlo
 *  si vede in faccia a un cliente, quindi ha i test. */

/** Lavare + stirare: tre giorni pieni. È il ripiego storico, quello che vale
 *  quando il cliente non ha un piano con un tempo suo. */
export const ORE_LAVANDERIA = 72;

/** Solo stiro: due giorni. Niente lavaggio, niente asciugatura. */
export const ORE_STIRO = 48;

export function oreDiLavorazione(input: {
  /** Il servizio concordato col cliente (`profiles.tipo_servizio`). */
  tipoServizio?: TipoServizio | string | null;
  /** Le ore del suo piano di listino, se ne ha uno. */
  orePiano?: number | null;
}): number {
  if (input.tipoServizio === "solo_stiro") return ORE_STIRO;
  const piano = input.orePiano;
  return typeof piano === "number" && Number.isFinite(piano) && piano > 0 ? piano : ORE_LAVANDERIA;
}
