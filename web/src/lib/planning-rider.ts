/** Quando torna indietro un sacco ritirato oggi.
 *
 *  La regola
 *  ---------
 *  Ritiro più il turnaround dell'abbonamento — 72 ore — e basta. **Non si
 *  guarda la lavanderia.** Il rider deve poter dire «quello che ritiro martedì
 *  lo riporto venerdì» mentre è sul pianerottolo, non dopo che qualcuno in
 *  lavanderia ha premuto «pronto»: se la previsione dipendesse da quel gesto,
 *  metà settimana resterebbe vuota sul suo calendario fino all'ultimo momento,
 *  e non si pianifica un giro così.
 *
 *  È la stessa promessa che facciamo al cliente — «entro 3 giorni feriali» — e
 *  lo stesso numero con cui l'ordine nasce (`orders.eta_ready_at`). Mostrarne
 *  uno diverso al rider vorrebbe dire avere due calendari.
 *
 *  Previsione, non impegno
 *  -----------------------
 *  Quando la riconsegna ha già una fascia vera quella vince sempre: è stata
 *  concordata. La previsione riempie solo i buchi, e chi legge deve vedere che
 *  è una previsione — per questo la funzione dice anche *quale* delle due è. */

export const TURNAROUND_ORE = 72;

export function riconsegnaPrevista(ritiroIso: string, ore: number = TURNAROUND_ORE): string {
  return new Date(Date.parse(ritiroIso) + ore * 3600_000).toISOString();
}

export type Passaggio = {
  orderId: string;
  tipo: "ritiro" | "riconsegna";
  /** `false` quando la data è calcolata dalle 72 ore invece che da una fascia. */
  confermato: boolean;
  quando: string;
};

/** I due passaggi di un ordine: il ritiro e il ritorno.
 *
 *  @param etaPronto  `orders.eta_ready_at`, già calcolato alla creazione. Si
 *                    riusa invece di ricalcolarlo perché è il numero che il
 *                    cliente ha visto: ricalcolarlo qui aprirebbe la porta a
 *                    due date diverse per lo stesso ordine. */
export function passaggiDellOrdine(o: {
  id: string;
  ritiroIso: string | null;
  riconsegnaIso: string | null;
  etaPronto: string | null;
  ritiroFatto: boolean;
  chiuso: boolean;
}): Passaggio[] {
  const out: Passaggio[] = [];
  if (o.ritiroIso && !o.ritiroFatto) {
    out.push({ orderId: o.id, tipo: "ritiro", confermato: true, quando: o.ritiroIso });
  }
  if (o.chiuso) return out;

  if (o.riconsegnaIso) {
    out.push({ orderId: o.id, tipo: "riconsegna", confermato: true, quando: o.riconsegnaIso });
  } else {
    // Senza fascia si proietta: prima dall'ETA dell'ordine, e solo se manca
    // anche quello si ricalcola dal ritiro.
    const stimato = o.etaPronto ?? (o.ritiroIso ? riconsegnaPrevista(o.ritiroIso) : null);
    if (stimato) out.push({ orderId: o.id, tipo: "riconsegna", confermato: false, quando: stimato });
  }
  return out;
}
