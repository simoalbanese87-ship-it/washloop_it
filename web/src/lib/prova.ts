/** Quando scatta il primo addebito di una prova gratuita.
 *
 *  La promessa al cliente è una sola: **paghi il giorno dopo che ti riportiamo
 *  il bucato**. Qui si traduce in una data, e le date sono la cosa che in
 *  questo mestiere si sbaglia in silenzio — per questo sta in un modulo puro,
 *  senza database e senza Stripe, con i test.
 *
 *  Le due garanzie che rendono impossibile il «gratis per sempre»
 *  -------------------------------------------------------------
 *  1. Il risultato non supera mai il **tetto**, che è congelato alla creazione
 *     della prova e non si ricalcola: ogni disdetta riporta la data al
 *     paracadute, ogni prenotazione la ricalcola, ma nessuna delle due può
 *     sfondare il muro.
 *  2. Il risultato non è mai prima di `adesso + MARGINE_ORE`: Stripe rifiuta un
 *     `trial_end` troppo vicino, e una data nel passato farebbe fallire
 *     l'aggiornamento lasciando la prova dov'era.
 *
 *  Sono invarianti, non casi particolari: i test le affermano su ancore
 *  casuali, non su tre esempi scelti bene. */

/** Il paracadute, in giorni: entro quanto va prenotato il primo ritiro.
 *
 *  Dieci e non sette: un ritiro prenotato all'ultimo, più 72 ore di
 *  lavorazione, resta sotto il tetto. E dieci giorni stanno dentro i 14 di
 *  recesso, quindi nessuno paga prima di poter recedere. */
export const GIORNI_PER_PRENOTARE = 10;

/** Il muro. Qualunque cosa succeda agli ordini, la prova non va oltre.
 *  Ventuno giorni: due ritiri e mezzo, che è il massimo che un cliente può
 *  ricevere prima di pagare anche nello scenario peggiore. */
export const TETTO_GIORNI = 21;

/** Stripe rifiuta un `trial_end` a meno di 48 ore. Quarantanove, per non
 *  giocarsi il risultato sul bordo: se un ritiro è così vicino che la data
 *  calcolata cade sotto, si addebita un po' dopo — cioè a favore del cliente. */
export const MARGINE_ORE = 49;

/** Il giorno dopo la riconsegna. Ventiquattro ore esatte, non «la data civile
 *  successiva»: Roma ha l'ora legale, e «il giorno dopo» inteso come data
 *  richiederebbe di scegliere un'ora e di sbagliarla ai bordi — una riconsegna
 *  di venerdì alle 20 addebitata «sabato alle 00:00» sono quattro ore, non un
 *  giorno, e chi legge «paghi il giorno dopo la consegna» avrebbe ragione a
 *  lamentarsi. Ventiquattro ore non sono mai *prima* di quanto promesso. */
export const GIORNO_DOPO_ORE = 24;

const ORA = 3600_000;
const GIORNO = 24 * ORA;

/** Da dove viene la data: serve all'admin per capire perché è quella. */
export type Origine = "riconsegna" | "eta" | "ritiro" | "paracadute";

export type Ancora = {
  /** La fascia di riconsegna concordata, se il cliente l'ha scelta. */
  riconsegnaIso?: string | null;
  /** `orders.eta_ready_at`: il «pronto entro» che abbiamo già mostrato. */
  etaProntoIso?: string | null;
  ritiroIso?: string | null;
  /** Ore di lavorazione del piano. Il ripiego è quello del calendario rider. */
  turnaroundOre?: number | null;
};

export type Addebito = {
  /** ISO. */
  quando: string;
  origine: Origine;
  /** Se e perché la data è stata riportata dentro i limiti. */
  clampato: "tetto" | "minimo" | null;
};

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

/** Il paracadute: fine prova se non si prenota mai. */
export function paracadute(inizioProvaIso: string, giorni = GIORNI_PER_PRENOTARE): string {
  const t = ms(inizioProvaIso) ?? Date.now();
  return new Date(t + giorni * GIORNO).toISOString();
}

/** Il muro, calcolato una volta sola alla creazione della prova. */
export function tetto(inizioProvaIso: string, giorni = TETTO_GIORNI): string {
  const t = ms(inizioProvaIso) ?? Date.now();
  return new Date(t + giorni * GIORNO).toISOString();
}

/** Quando addebitare, dato quello che sappiamo del primo ritiro.
 *
 *  L'ordine di preferenza ricalca quello con cui si mostra un ordine al
 *  cliente: la fascia concordata vince su tutto, perché è la data che lui ha in
 *  mano; poi l'ETA già calcolata, **riusata e non ricalcolata** — ricalcolarla
 *  aprirebbe la porta a due date diverse per lo stesso ordine, e qui la seconda
 *  è un addebito. */
export function dataAddebito(
  ancora: Ancora | null,
  inizioProvaIso: string,
  opzioni: { giorniParacadute?: number; giorniTetto?: number; adesso?: number } = {},
): Addebito {
  const adesso = opzioni.adesso ?? Date.now();
  const limite = ms(tetto(inizioProvaIso, opzioni.giorniTetto ?? TETTO_GIORNI))!;
  const minimo = adesso + MARGINE_ORE * ORA;

  let base: number | null = null;
  let origine: Origine = "paracadute";

  const riconsegna = ms(ancora?.riconsegnaIso);
  const eta = ms(ancora?.etaProntoIso);
  const ritiro = ms(ancora?.ritiroIso);

  if (riconsegna != null) {
    base = riconsegna;
    origine = "riconsegna";
  } else if (eta != null) {
    base = eta;
    origine = "eta";
  } else if (ritiro != null) {
    const ore = typeof ancora?.turnaroundOre === "number" && ancora.turnaroundOre > 0 ? ancora.turnaroundOre : 72;
    base = ritiro + ore * ORA;
    origine = "ritiro";
  }

  let quando = base != null ? base + GIORNO_DOPO_ORE * ORA : ms(paracadute(inizioProvaIso, opzioni.giorniParacadute))!;

  // I due clamp, in quest'ordine: prima il muro, poi il minimo tecnico. Se il
  // tetto stesso fosse già passato (prova vecchia, webhook in ritardo) vince il
  // minimo, perché una data che Stripe rifiuta non è una data.
  let clampato: "tetto" | "minimo" | null = null;
  if (quando > limite) {
    quando = limite;
    clampato = "tetto";
  }
  if (quando < minimo) {
    quando = minimo;
    clampato = "minimo";
  }

  return { quando: new Date(quando).toISOString(), origine, clampato };
}

/** Vale la pena chiamare Stripe?
 *
 *  Una tolleranza di un'ora, perché il ricalcolo può produrre differenze di
 *  minuti che non cambiano niente per nessuno e che, senza questa guardia,
 *  diventerebbero una chiamata a Stripe a ogni revalidate. È questa funzione a
 *  rendere no-op le doppie chiamate, non un lucchetto altrove. */
export function vaAggiornata(attualeIso: string | null | undefined, nuovaIso: string, tolleranzaMinuti = 60): boolean {
  const a = ms(attualeIso);
  if (a == null) return true;
  const n = ms(nuovaIso);
  if (n == null) return false;
  return Math.abs(n - a) > tolleranzaMinuti * 60_000;
}
