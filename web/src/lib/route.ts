/** Ottimizzazione percorso rider (euristica, nessun servizio esterno).
 *  Earliest-deadline-first + nearest-neighbor: rispetta le finestre orarie
 *  (deadline = fine slot) e, tra fermate con deadline vicine, sceglie la più
 *  vicina geograficamente partendo dal deposito. Sufficiente per pochi stop. */

export type RouteStop = {
  lat: number;
  lng: number;
  deadlineMs: number | null; // slot ends_at in ms (null = nessuna deadline)
};

const WINDOW_MS = 60 * 60 * 1000; // raggruppa deadline entro 60 min

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export type Partenza = { lat: number; lng: number } | null;

/** Da dove comincia il giro.
 *
 *  Non è sempre lo stesso posto, e confonderli manda il rider dalla parte
 *  sbagliata. Se la prima cosa da fare è una CONSEGNA, il giro comincia dalla
 *  lavanderia: è lì che si caricano i sacchi puliti, e per WashLoop la
 *  lavanderia è a Zanica, quaranta chilometri fuori Milano — partire dal
 *  deposito darebbe un ordine di visita costruito su un viaggio che nessuno fa.
 *  Se invece si comincia con i RITIRI, il rider parte dal deposito e le case
 *  dei clienti sono le fermate: quello era già giusto.
 *
 *  Funzione pura e separata apposta: è una riga di logica che decide l'ordine
 *  di tutta la giornata, e va potuta collaudare senza mappa né database. */
export function partenzaDelGiro(
  primaFermataÈConsegna: boolean,
  lavanderia: Partenza,
  deposito: Partenza,
): Partenza {
  if (primaFermataÈConsegna && lavanderia) return lavanderia;
  return deposito ?? lavanderia;
}

/** Ritorna gli indici di `stops` nell'ordine di visita ottimizzato. */
export function optimizeOrder(depot: { lat: number; lng: number } | null, stops: RouteStop[]): number[] {
  const remaining = stops.map((_, i) => i);
  const order: number[] = [];
  let curLat = depot?.lat ?? null;
  let curLng = depot?.lng ?? null;

  while (remaining.length) {
    const minDeadline = Math.min(...remaining.map((i) => stops[i].deadlineMs ?? Infinity));
    const eligible = remaining.filter((i) => (stops[i].deadlineMs ?? Infinity) <= minDeadline + WINDOW_MS);

    let pick = eligible[0];
    if (curLat != null && curLng != null) {
      let bestD = Infinity;
      for (const i of eligible) {
        const d = haversineKm(curLat, curLng, stops[i].lat, stops[i].lng);
        if (d < bestD) { bestD = d; pick = i; }
      }
    }
    order.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
    curLat = stops[pick].lat;
    curLng = stops[pick].lng;
  }
  return order;
}
