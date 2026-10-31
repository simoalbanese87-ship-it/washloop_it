/** «Come ci hai conosciuto», le risposte possibili.
 *
 *  Perché un elenco chiuso
 *  -----------------------
 *  Un campo libero raccoglie dati che nessuno rilegge: «un'amica», «amica»,
 *  «me l'ha detto un'amica» sono tre righe diverse per la stessa cosa, e alla
 *  fine del mese nessuno le conta. Un elenco si conta da solo.
 *
 *  Le voci sono quelle che cambiano una decisione. **Assistente AI** sta
 *  prima perché è il canale che oggi non si misura in nessun altro modo: chi
 *  arriva da una risposta di ChatGPT non porta nessun referrer, e senza questa
 *  domanda quel traffico non esiste nei rapporti. **Passaparola** per lo
 *  stesso motivo: una persona che ne manda un'altra non è un clic.
 *
 *  Modulo puro e senza dipendenze: lo leggono il modulo di iscrizione, che è
 *  codice del browser, e il pannello, che è codice del server. */

export const COME_CONOSCIUTO = [
  "passaparola",
  "assistente_ai",
  "ricerca_google",
  "social",
  "volantino",
  "rider_in_zona",
  "altro",
] as const;

export type ComeConosciuto = (typeof COME_CONOSCIUTO)[number];

/** Come si chiede al cliente: in seconda persona, come una domanda vera. */
export const COME_CONOSCIUTO_DOMANDA: Record<ComeConosciuto, string> = {
  passaparola: "Me ne ha parlato qualcuno",
  assistente_ai: "ChatGPT o un altro assistente",
  ricerca_google: "Cercando su Google",
  social: "Instagram o Facebook",
  volantino: "Un volantino o un adesivo",
  rider_in_zona: "Ho visto il rider in zona",
  altro: "In un altro modo",
};

/** Come si legge in pannello: corto, perché sta in una riga di tabella. */
export const COME_CONOSCIUTO_LABEL: Record<ComeConosciuto, string> = {
  passaparola: "Passaparola",
  assistente_ai: "Assistente AI",
  ricerca_google: "Ricerca Google",
  social: "Social",
  volantino: "Volantino",
  rider_in_zona: "Rider in zona",
  altro: "Altro",
};

export function isComeConosciuto(v: unknown): v is ComeConosciuto {
  return typeof v === "string" && (COME_CONOSCIUTO as readonly string[]).includes(v);
}

/** L'etichetta di un valore letto dal database, o `null` se non ha risposto.
 *
 *  `null` non è «altro»: sono due cose diverse, e contarle insieme falserebbe
 *  ogni percentuale. Chi legge deve poter distinguere «non lo so» da «me
 *  l'ha detto e non rientrava nell'elenco». */
export function etichettaComeConosciuto(v: unknown): string | null {
  return isComeConosciuto(v) ? COME_CONOSCIUTO_LABEL[v] : null;
}
