/** Sequenza degli stati, ricopiata da ORDER_FLOW (`src/lib/orders.ts`).
 *
 *  Non la importo: questo file ha test unitari, il runner di Node non conosce
 *  l'alias `@/` e il progetto non ammette l'estensione .ts negli import dei
 *  sorgenti. Il rischio della copia — che le due liste divergano — è coperto
 *  da un test che le confronta: se qualcuno aggiunge uno stato di là e non di
 *  qua, il test diventa rosso. */
export const SEQUENZA = [
  "requested",
  "pickup_scheduled",
  "picked_up",
  "at_laundry",
  "washing",
  "ready",
  "delivery_scheduled",
  "out_for_delivery",
  "delivered",
  "completed",
] as const;

export type StatoOrdine = (typeof SEQUENZA)[number] | "cancelled" | "delivery_failed";

const posizione = (s: StatoOrdine): number => (SEQUENZA as readonly string[]).indexOf(s);

/** I passaggi: i due momenti in cui WashLoop tocca la vita del cliente.
 *
 *  Abbiamo provato a chiamare la riga «ordine», poi «lavaggio», poi «ritiro»,
 *  e nessuno funzionava — perché una riga rappresenta DUE eventi diversi (il
 *  ritiro di lunedì, la riconsegna di giovedì) più la lavorazione in mezzo, e
 *  qualunque sostantivo singolo ne racconta metà.
 *
 *  Qui l'ordine viene scomposto in ciò che il cliente ha davvero in mente:
 *  «lunedì passano a prendere, giovedì me lo riportano». Ogni voce nomina
 *  esattamente quello che contiene, quindi non c'è più una parola sbagliata.
 *
 *  È solo una lettura diversa degli stessi dati: nel database non cambia
 *  niente, e rider, lavanderia e pannello continuano a ragionare per ordine —
 *  che per loro è giusto, perché prendono in carico un giro intero. */

export type TipoPassaggio = "ritiro" | "riconsegna";
export type StatoPassaggio = "previsto" | "fatto" | "non_riuscito" | "annullato";

export type Passaggio = {
  /** Chiave stabile per React: un ordine genera al massimo due voci. */
  chiave: string;
  orderId: string;
  tipo: TipoPassaggio;
  /** Inizio della fascia, ISO. Null quando la riconsegna non è ancora fissata. */
  quando: string | null;
  fine: string | null;
  stato: StatoPassaggio;
  bags: number;
};

export type OrdinePerPassaggi = {
  id: string;
  status: StatoOrdine;
  created_at: string;
  bags: number;
  pickup_at: string | null;
  pickup_end: string | null;
  delivery_at: string | null;
  delivery_end: string | null;
};

/** Scompone un ordine nei suoi passaggi.
 *
 *  Il ritiro esiste sempre: senza, l'ordine non sarebbe nato. La riconsegna
 *  compare appena il bucato è pronto — anche prima che la fascia sia fissata,
 *  perché «da programmare» è un'informazione, mentre farla sparire dalla lista
 *  lascerebbe il cliente senza sapere che sta per tornare qualcosa. */
export function passaggiDiOrdine(o: OrdinePerPassaggi): Passaggio[] {
  const out: Passaggio[] = [];
  const annullato = o.status === "cancelled";
  const idx = posizione(o.status);

  out.push({
    chiave: `${o.id}-ritiro`,
    orderId: o.id,
    tipo: "ritiro",
    // Un ordine senza slot (creato a mano dall'admin) mostra la data di
    // creazione: meglio una data approssimata che una riga senza quando.
    quando: o.pickup_at ?? o.created_at,
    fine: o.pickup_end,
    stato: annullato ? "annullato" : idx >= posizione("picked_up") ? "fatto" : "previsto",
    bags: o.bags,
  });

  const prontoOOltre = idx >= posizione("ready");
  if (prontoOOltre || o.delivery_at) {
    out.push({
      chiave: `${o.id}-riconsegna`,
      orderId: o.id,
      tipo: "riconsegna",
      quando: o.delivery_at,
      fine: o.delivery_end,
      stato: annullato
        ? "annullato"
        : o.status === "delivery_failed"
          ? "non_riuscito"
          : idx >= posizione("delivered")
            ? "fatto"
            : "previsto",
      bags: o.bags,
    });
  }

  return out;
}

/** Prossimi e passati, ciascuno nel suo ordine naturale.
 *
 *  «Prossimi» in avanti (il primo è quello che succede prima), «passati»
 *  all'indietro (il primo è l'ultimo accaduto). Le riconsegne senza data
 *  restano tra i prossimi, in fondo: stanno per succedere, semplicemente non
 *  sappiamo ancora quando. */
export function dividiPassaggi(ordini: OrdinePerPassaggi[]): { prossimi: Passaggio[]; passati: Passaggio[] } {
  const tutti = ordini.flatMap(passaggiDiOrdine);

  const prossimi = tutti
    .filter((p) => p.stato === "previsto")
    .sort((a, b) => {
      if (!a.quando) return 1; // senza data in coda
      if (!b.quando) return -1;
      return a.quando.localeCompare(b.quando);
    });

  const passati = tutti
    .filter((p) => p.stato !== "previsto")
    .sort((a, b) => (b.quando ?? "").localeCompare(a.quando ?? ""));

  return { prossimi, passati };
}

/** Il passaggio da mettere in cima alla Home: il primo che succede. */
export function prossimoPassaggio(ordini: OrdinePerPassaggi[]): Passaggio | null {
  return dividiPassaggi(ordini).prossimi.find((p) => p.quando) ?? null;
}
