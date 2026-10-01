/** Quali CAP accettiamo come richiesta, e quali diciamo di coprire.
 *
 *  Due domande diverse, e vanno tenute diverse
 *  -------------------------------------------
 *  1. **«Accettiamo la richiesta?»** — da oggi sì per tutta Milano città. La
 *     decisione è di Simone: meglio raccogliere il contatto e scremare al
 *     telefono che dire di no a qualcuno che magari sta a due strade dal giro.
 *  2. **«A quale zona appartiene questo indirizzo?»** — quella la decide
 *     `zoneIdForCap` leggendo `zone_caps`. Dal 1° ottobre 2026 anche quella
 *     copre tutta Milano: i quattro quadranti sono tutti attivi e il rider è
 *     Meryl su tutti e quattro. Prima qui c'era scritto che allargarla avrebbe
 *     significato «mandare Meryl all'Isola perché un lead ha scritto 20159»:
 *     la cautela è decaduta perché Meryl l'area la copre davvero, non perché
 *     il problema non esistesse.
 *
 *  Le due cose restano separate lo stesso, ed è il motivo per cui questo file
 *  esiste: questa risponde a chi scrive il CAP, l'altra decide chi ci va. Una
 *  zona si spegne dal pannello senza toccare il codice, e quel giorno la
 *  seconda cambia e questa no.
 *
 *  I CAP di Milano città
 *  ---------------------
 *  Sono **38**, fra 20121 e 20162, più il 20100 generico che si trova ancora
 *  scritto su molti moduli. Non sono un intervallo pieno: 20130, 20140, 20150 e
 *  20160 non esistono, e generandoli dall'intervallo finivano stampati sulle
 *  pagine pubbliche insieme agli altri. Sotto il 20121 e sopra il 20162 si è
 *  fuori comune: 20089 è Rozzano, 20090 Assago e Buccinasco — che serviamo, ma
 *  per scelta esplicita, non perché cadano in un intervallo. */

/** Il CAP generico di Milano, ancora usato da chi non ricorda il proprio. */
const CAP_MILANO_GENERICO = "20100";

/** I comuni fuori Milano dove passiamo. Stessi delle FAQ e di `area-servita`:
 *  se un giorno se ne aggiunge uno, va aggiunto qui e in `zone_caps`. */
const CAP_COMUNI_SERVITI = ["20089", "20090"] as const;

/** Tutti i CAP di Milano città, uno per uno: i 38 che esistono davvero, gli
 *  stessi che stanno in `zone_caps`.
 *
 *  Serve a scriverli in pagina. «Copriamo Milano» è una frase che scrivono
 *  tutti; «20147» è la parola che una persona digita davvero quando cerca, ed è
 *  l'unica verificabile. Elencati e non generati dall'intervallo 20121-20162,
 *  che ne produrrebbe quarantadue: le decine tonde — 20130, 20140, 20150,
 *  20160 — non sono CAP di nessuno, e finivano pubblicate come le altre. */
export const CAP_MILANO: string[] = [
  "20121", "20122", "20123", "20124", "20125", "20126", "20127", "20128", "20129",
  "20131", "20132", "20133", "20134", "20135", "20136", "20137", "20138", "20139",
  "20141", "20142", "20143", "20144", "20145", "20146", "20147", "20148", "20149",
  "20151", "20152", "20153", "20154", "20155", "20156", "20157", "20158", "20159",
  "20161", "20162",
];

/** Quelli fuori città, per scriverli accanto. */
export const CAP_COMUNI = [...CAP_COMUNI_SERVITI];

export function formatoCapValido(cap: string): boolean {
  return /^\d{5}$/.test(cap.trim());
}

/** Il CAP è di Milano città.
 *
 *  Guarda l'elenco e non l'intervallo: è l'elenco quello che pubblichiamo, e
 *  due regole diverse per la stessa domanda sono due pagine che si
 *  contraddicono. */
export function capDiMilano(cap: string): boolean {
  const c = cap.trim();
  if (!formatoCapValido(c)) return false;
  if (c === CAP_MILANO_GENERICO) return true;
  return CAP_MILANO.includes(c);
}

/** Il CAP è uno dei comuni serviti fuori città. */
export function capComuneServito(cap: string): boolean {
  return (CAP_COMUNI_SERVITI as readonly string[]).includes(cap.trim());
}

export type EsitoCap = "in-zona" | "fuori-zona";

/** Cosa rispondiamo a chi scrive il suo CAP.
 *
 *  «in-zona» non vuol dire «il rider passa da lì domani»: vuol dire che la
 *  richiesta la prendiamo e la valutiamo. Il copy che accompagna questo esito
 *  dice infatti «ti ricontattiamo per confermare disponibilità», non «sei
 *  servito» — è la promessa che possiamo mantenere. */
export function esitoCap(cap: string): EsitoCap {
  return capDiMilano(cap) || capComuneServito(cap) ? "in-zona" : "fuori-zona";
}

/** Il valore che finisce in `leads.covered`. Serve all'admin per sapere quali
 *  richiami per primo, e alla mail di conferma per scegliere il testo. */
export function capCoperto(cap: string): boolean {
  return esitoCap(cap) === "in-zona";
}
