/** Ottimizzazione percorso rider (euristica, nessun servizio esterno).
 *  Earliest-deadline-first + nearest-neighbor: rispetta le finestre orarie
 *  (deadline = fine slot) e, tra fermate con deadline vicine, sceglie la più
 *  vicina geograficamente partendo dal deposito. Sufficiente per pochi stop. */

export type RouteStop = {
  lat: number;
  lng: number;
  deadlineMs: number | null; // slot ends_at in ms (null = nessuna deadline)
  /** A quale giro appartiene la fermata: oggi è la destinazione del sacco —
   *  la lavanderia generale o la stireria del solo stiro. A parità di urgenza
   *  si finisce un giro prima di cominciare l'altro. */
  gruppo?: string | null;
  /** In che momento del giro sta quella fermata: **0 le riconsegne, 1 i
   *  ritiri**.
   *
   *  Non è una preferenza grafica, è come si carica il furgone. Si parte dalla
   *  lavanderia con i sacchi puliti, si consegnano, e solo dopo si comincia a
   *  riempire di sporco: alternando le due cose, pulito e sporco viaggiano
   *  insieme e a fine giro nessuno sa più cosa scaricare. */
  fase?: number | null;
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

/** Ritorna gli indici di `stops` nell'ordine di visita ottimizzato.
 *
 *  Quattro criteri, in quest'ordine — e l'ordine è il punto:
 *
 *  1. **La fascia oraria**, sempre per prima. Si guardano solo le fermate la
 *     cui scadenza è entro un'ora dalla più urgente: niente di quello che
 *     viene dopo può far arrivare il rider fuori da una fascia promessa.
 *  2. **La fase**: prima le riconsegne, poi i ritiri. Si parte dalla
 *     lavanderia col pulito, si consegna, e solo dopo si comincia a caricare
 *     lo sporco — mescolarli vuol dire non sapere più cosa c'è nel furgone.
 *  3. **Il giro**, fra quelle rimaste: a parità di urgenza e di fase si resta
 *     sulle fermate della stessa destinazione. Da quando le sedi sono due —
 *     Zanica e Corsico — alternarle significa non sapere, mentre si ritira,
 *     quale sacco sta andando dove.
 *  4. **La distanza**: la più vicina fra quelle rimaste.
 *
 *  La fascia resta sopra tutto: se un cliente ha un orario promesso dentro la
 *  finestra, la sua fermata passa avanti anche se è della fase o del giro
 *  sbagliato. Quando succede si vede — `fuoriBlocco` lo dice, e a schermo si
 *  scrive perché. */
export function optimizeOrder(depot: { lat: number; lng: number } | null, stops: RouteStop[]): number[] {
  const remaining = stops.map((_, i) => i);
  const order: number[] = [];
  let curLat = depot?.lat ?? null;
  let curLng = depot?.lng ?? null;
  let curGruppo: string | null = null;

  while (remaining.length) {
    const minDeadline = Math.min(...remaining.map((i) => stops[i].deadlineMs ?? Infinity));
    const eligible = remaining.filter((i) => (stops[i].deadlineMs ?? Infinity) <= minDeadline + WINDOW_MS);

    // Prima la fase: fra le fermate altrettanto urgenti si prendono quelle
    // della fase più bassa, cioè le riconsegne finché ce ne sono.
    const faseMinima = Math.min(...eligible.map((i) => stops[i].fase ?? 0));
    const dellaFase: number[] = eligible.filter((i) => (stops[i].fase ?? 0) === faseMinima);

    // Poi il giro, dentro la fase. Se nel giro in corso non resta niente di
    // altrettanto urgente si passa all'altro: comanda sempre la fascia.
    // I tipi sono scritti a mano: `curGruppo` viene da `pick`, che viene da
    // `candidati`, che viene da `curGruppo` — l'inferenza gira in tondo.
    const stessoGruppo: number[] = curGruppo != null ? dellaFase.filter((i) => (stops[i].gruppo ?? null) === curGruppo) : [];
    const candidati: number[] = stessoGruppo.length > 0 ? stessoGruppo : dellaFase;

    let pick: number = candidati[0];
    if (curLat != null && curLng != null) {
      let bestD = Infinity;
      for (const i of candidati) {
        const d = haversineKm(curLat, curLng, stops[i].lat, stops[i].lng);
        if (d < bestD) { bestD = d; pick = i; }
      }
    }
    order.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
    curLat = stops[pick].lat;
    curLng = stops[pick].lng;
    curGruppo = stops[pick].gruppo ?? null;
  }
  return order;
}

/** Quali fermate finiscono fuori dal loro blocco, e vanno spiegate.
 *
 *  Il giro si legge a blocchi — prima le riconsegne, poi i ritiri — ma la
 *  fascia oraria viene prima di tutto: un cliente con l'ora promessa alle 8:30
 *  passa avanti anche se la sua fermata è di un'altra fase. Quando succede, la
 *  riga a schermo deve dirlo: senza, sembra che il percorso si sia sbagliato.
 *
 *  Una fermata è fuori blocco quando **dopo** di lei ne viene una di una fase
 *  precedente: è il ritiro infilato prima delle riconsegne, non la riconsegna
 *  che le viene dopo.
 *
 *  Prende le fasi **nell'ordine di visita** e risponde nello stesso ordine. */
export function fuoriBlocco(fasi: (number | null | undefined)[]): boolean[] {
  const n = (v: number | null | undefined) => (typeof v === "number" ? v : 0);
  return fasi.map((f, i) => fasi.slice(i + 1).some((dopo) => n(dopo) < n(f)));
}
