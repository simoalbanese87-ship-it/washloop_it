// `import type` e non un import normale: questo modulo lo eseguono anche i
// test con node:test, che non sa risolvere l'alias `@/`. Il tipo sparisce in
// compilazione, l'import con lui.
import type { TipoServizio } from "@/lib/tipo-servizio";

/** In quale lista di Brevo sta una persona, e da quali deve uscire.
 *
 *  Il punto di questo modulo è che la regola stia **in un posto solo**. Le
 *  liste si popolano da quattro punti diversi del codice — chi apre un account,
 *  chi paga, chi si disiscrive, chi cambia tipo di servizio dal pannello — e se
 *  ognuno decidesse per conto suo, nel giro di un mese la stessa persona
 *  starebbe in due cluster e riceverebbe «torna da noi» il giorno dopo aver
 *  pagato.
 *
 *  Le liste si nominano, non si numerano: gli id di Brevo si risolvono a
 *  runtime dal nome. Rinominarne una in pannello è un refuso da correggere,
 *  non un guasto in produzione — e un id scritto nel codice punterebbe in
 *  silenzio alla lista sbagliata se qualcuno la ricreasse. */

export const LISTA = {
  lead: "Lead Meta - WashLoop",
  accountFree: "Account Free Creato",
  clienti: "Clienti Attivi WashLoop",
  soloStiro: "Solo Stiro",
  disiscritti: "Disiscritti",
} as const;

export type NomeLista = (typeof LISTA)[keyof typeof LISTA];

export type Cluster = "disiscritto" | "clienti" | "account_free" | "lead";

export type Persona = {
  /** Esiste un profilo sul sito (non un semplice lead). */
  haAccount: boolean;
  /** Ha avuto un abbonamento, anche se oggi è chiuso. */
  haAvutoAbbonamento: boolean;
  /** Ha chiesto di non ricevere più email. */
  disiscritto: boolean;
};

/** Un cluster solo per persona, e l'ordine conta.
 *
 *  La disiscrizione vince su tutto: è l'unica che esprime una volontà, le altre
 *  descrivono solo uno stato. Chi ha pagato resta «cliente» anche dopo la
 *  disdetta — deciso da Simone l'8 ottobre 2026: «se il cliente disattiva
 *  l'abbonamento tienilo nei clienti attivi e poi ci pensiamo». */
export function clusterDi(p: Persona): Cluster {
  if (p.disiscritto) return "disiscritto";
  if (p.haAvutoAbbonamento) return "clienti";
  if (p.haAccount) return "account_free";
  return "lead";
}

export type Appartenenze = { dentro: NomeLista[]; fuori: NomeLista[] };

/** Le liste in cui la persona deve stare, e quelle da cui va tolta.
 *
 *  `fuori` non è «tutte le altre»: è l'elenco di quelle da cui questo cluster
 *  esclude davvero. Un lead che non si è mai registrato non lo tocchiamo — in
 *  «Lead Meta» ce lo mette la pubblicità, e togliercelo noi vorrebbe dire
 *  combattere con Meta ogni notte. */
export function listeDi(cluster: Cluster, tipoServizio: TipoServizio | null): Appartenenze {
  const soloStiro = tipoServizio === "solo_stiro";

  if (cluster === "disiscritto") {
    // Chi non vuole più email esce da tutto, «Solo stiro» compreso: è una lista
    // di invio come le altre, non un'etichetta anagrafica.
    return {
      dentro: [LISTA.disiscritti],
      fuori: [LISTA.lead, LISTA.accountFree, LISTA.clienti, LISTA.soloStiro],
    };
  }

  const dentro: NomeLista[] = [];
  const fuori: NomeLista[] = [LISTA.disiscritti];

  if (cluster === "clienti") {
    dentro.push(LISTA.clienti);
    fuori.push(LISTA.lead, LISTA.accountFree);
  } else if (cluster === "account_free") {
    dentro.push(LISTA.accountFree);
    fuori.push(LISTA.lead, LISTA.clienti);
  } else {
    // Lead puro: nessuna lista nostra, e nessuna rimozione dalla sua.
    fuori.push(LISTA.accountFree, LISTA.clienti);
  }

  if (soloStiro) dentro.push(LISTA.soloStiro);
  else fuori.push(LISTA.soloStiro);

  return { dentro, fuori };
}

/** Comodità per chi ha in mano la persona e non il cluster. */
export function appartenenzeDi(p: Persona, tipoServizio: TipoServizio | null): Appartenenze {
  return listeDi(clusterDi(p), tipoServizio);
}
