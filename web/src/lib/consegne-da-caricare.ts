/** Cosa aspetta il rider in lavanderia, e cosa è già suo.
 *
 *  Il giro del rider mostra solo le fermate su cui può premere qualcosa. È
 *  giusto, ma il 2 ottobre quella regola gli ha fatto leggere «Nessuna fermata
 *  assegnata» mentre quattro consegne di quella mattina erano lì, ferme su «in
 *  lavaggio» da tre giorni perché nessuno in lavanderia aveva premuto «pronto».
 *
 *  Da qui nasce la divisione in due: le consegne di oggi ancora in lavorazione
 *  sono **da caricare** — il giro parte dalla lavanderia, il rider è davanti ai
 *  sacchi e non deve aspettare nessuno — e il resto è il giro vero.
 *
 *  Funzione pura: è la regola che decide cosa vede il rider la mattina, e va
 *  potuta provare senza database. */

import type { OrderStatus } from "@/lib/orders";

/** Le fermate su cui il rider può già premere qualcosa. */
export const AZIONABILI: OrderStatus[] = ["pickup_scheduled", "delivery_scheduled", "out_for_delivery"];

/** Il sacco è dentro la lavanderia: ritirato, arrivato, in lavaggio o pronto. */
export const IN_LAVORAZIONE: OrderStatus[] = ["picked_up", "at_laundry", "washing", "ready"];

export type RigaGiro = {
  status: OrderStatus;
  /** Inizio della fascia di riconsegna, `null` se non è ancora fissata. */
  riconsegnaIso: string | null;
};

export function eAzionabile(status: OrderStatus): boolean {
  return AZIONABILI.includes(status);
}

/** Va caricata oggi: è in lavanderia e ha una fascia di riconsegna entro stasera.
 *
 *  Senza fascia non si carica: non c'è un giro in cui metterla, e il rider si
 *  troverebbe in furgone un sacco senza un'ora a cui portarlo. Arretrati
 *  compresi, come per le fermate: una consegna di ieri rimasta indietro va
 *  recuperata, non nascosta. */
export function daCaricareOggi<T extends RigaGiro>(righe: T[], fineGiornataMs: number): T[] {
  return righe.filter((r) => {
    if (!IN_LAVORAZIONE.includes(r.status)) return false;
    if (!r.riconsegnaIso) return false;
    const t = Date.parse(r.riconsegnaIso);
    if (Number.isNaN(t)) return false;
    return t <= fineGiornataMs;
  });
}
