/** Quale giornata far vedere in mappa al rider.
 *
 *  Il planning elenca i prossimi giorni, ma Meryl non chiede l'elenco: chiede
 *  come si organizza il **prossimo giro**, che è il martedì dei ritiri. Quindi
 *  si sceglie una giornata sola e si disegna quella.
 *
 *  Due regole, e sono entrambe necessarie:
 *  1. **da oggi in avanti**, mai un giorno passato: un giro già fatto non si
 *     organizza più, e l'arretrato il planning lo mostra già nel suo elenco;
 *  2. il giorno deve avere almeno un **ritiro con l'ora concordata**. Le
 *     riconsegne previste sono una stima a 72 ore: disegnare un giro su una
 *     stima vorrebbe dire mandare il rider a un indirizzo a un'ora che nessuno
 *     ha fissato.
 *
 *  Le date arrivano già ridotte a chiave di giorno Roma (`2026-10-13`), così il
 *  confronto è una comparazione di stringhe e non un fuso orario da indovinare. */

export type VoceGiro = {
  giorno: string;
  tipo: "ritiro" | "riconsegna";
  confermato: boolean;
};

export function primoGiornoDelGiro(voci: VoceGiro[], oggi: string): string | null {
  const giorni = voci
    .filter((v) => v.tipo === "ritiro" && v.confermato && v.giorno >= oggi)
    .map((v) => v.giorno)
    .sort();
  return giorni[0] ?? null;
}
