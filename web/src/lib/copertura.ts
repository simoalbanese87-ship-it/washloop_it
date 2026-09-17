/** Quali CAP accettiamo come richiesta, e quali diciamo di coprire.
 *
 *  Due domande diverse, e vanno tenute diverse
 *  -------------------------------------------
 *  1. **«Accettiamo la richiesta?»** — da oggi sì per tutta Milano città. La
 *     decisione è di Simone: meglio raccogliere il contatto e scremare al
 *     telefono che dire di no a qualcuno che magari sta a due strade dal giro.
 *  2. **«A quale zona appartiene questo indirizzo?»** — quella la decide
 *     `zoneIdForCap` leggendo `zone_caps`, e **non cambia**. È la mappa che
 *     assegna il rider: allargarla significherebbe mandare Meryl all'Isola
 *     perché un lead ha scritto 20159.
 *
 *  Le due cose stavano insieme — `covered` veniva da `zoneIdForCap` — ed è il
 *  motivo per cui questo file esiste: allargare la prima senza toccare la
 *  seconda.
 *
 *  I CAP di Milano città
 *  ---------------------
 *  Vanno da 20121 a 20162, più il 20100 generico che si trova ancora scritto su
 *  molti moduli. Sotto il 20121 e sopra il 20162 si è fuori comune: 20089 è
 *  Rozzano, 20090 Assago e Buccinasco — che serviamo, ma per scelta esplicita,
 *  non perché cadano in un intervallo. */

/** Il CAP generico di Milano, ancora usato da chi non ricorda il proprio. */
const CAP_MILANO_GENERICO = "20100";
const CAP_MILANO_DA = 20121;
const CAP_MILANO_A = 20162;

/** I comuni fuori Milano dove passiamo. Stessi delle FAQ e di `area-servita`:
 *  se un giorno se ne aggiunge uno, va aggiunto qui e in `zone_caps`. */
const CAP_COMUNI_SERVITI = ["20089", "20090"] as const;

export function formatoCapValido(cap: string): boolean {
  return /^\d{5}$/.test(cap.trim());
}

/** Il CAP è di Milano città. */
export function capDiMilano(cap: string): boolean {
  const c = cap.trim();
  if (!formatoCapValido(c)) return false;
  if (c === CAP_MILANO_GENERICO) return true;
  const n = Number(c);
  return n >= CAP_MILANO_DA && n <= CAP_MILANO_A;
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
