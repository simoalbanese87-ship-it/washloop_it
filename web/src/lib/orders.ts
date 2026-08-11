/** Stati ordine + etichette IT per la timeline di tracking.
 *  Allineato all'enum order_status nel DB. */

export type OrderStatus =
  | "requested"
  | "pickup_scheduled"
  | "picked_up"
  | "at_laundry"
  | "washing"
  | "ready"
  | "delivery_scheduled"
  | "out_for_delivery"
  | "delivered"
  | "delivery_failed"
  | "completed"
  | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  requested: "Richiesto",
  pickup_scheduled: "Ritiro programmato",
  picked_up: "Ritirato",
  at_laundry: "Arrivato",
  washing: "In lavaggio",
  ready: "Pronto",
  delivery_scheduled: "Consegna programmata",
  out_for_delivery: "In consegna",
  delivered: "Consegnato",
  delivery_failed: "Consegna non riuscita",
  completed: "Completato",
  cancelled: "Annullato",
};

/** Ordine progressivo per la timeline (escluso cancelled). */
export const ORDER_FLOW: OrderStatus[] = [
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
];

export function statusIndex(s: OrderStatus): number {
  return ORDER_FLOW.indexOf(s);
}

/** Stati in cui il sacco è fisicamente aperto sul banco della lavanderia: solo
 *  qui ha senso aggiungere capi speciali. Da "ready" in poi il sacco è chiuso e
 *  in attesa del rider. Elenco esplicito e non un confronto su `statusIndex`:
 *  `cancelled` e `delivery_failed` non stanno in ORDER_FLOW e darebbero -1. */
export const LAVORAZIONE_APERTA: OrderStatus[] = ["picked_up", "at_laundry", "washing"];

export type ItemStatus = "received" | "washing" | "ready" | "issue";

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  received: "Ricevuto",
  washing: "In lavaggio",
  ready: "Pronto",
  issue: "Problema",
};

/** Modalità di ritiro/consegna del sacco a un indirizzo. */
export type AccessMode = "door" | "home" | "concierge";

export const ACCESS_MODE_LABEL: Record<AccessMode, string> = {
  door: "Sacco fuori dalla porta",
  home: "Sono in casa",
  concierge: "Portineria",
};

/** Esito di una scansione borsa del rider (RITIRO/CONSEGNA dedotta dallo stato). */
export type ScanResult =
  | { ok: true; mode: "pickup" | "delivery"; seq: number; total: number; done: boolean; client: string; token?: string }
  | { ok: false; error: string };

/** Posizione live del rider mostrata al cliente (solo quando vicino e in fase attiva). */
export type RiderLivePos = { lat: number; lng: number; label: string; custLat: number; custLng: number } | null;

export type UserRole = "customer" | "courier" | "partner" | "admin" | "sales";

/** Home di destinazione dopo il login, per ruolo. */
export function roleHome(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "courier":
      return "/courier";
    case "partner":
      return "/laundry"; // portale lavanderia dedicato (dati anonimizzati)
    case "sales":
      return "/sales"; // dashboard lead per il team commerciale
    default:
      return "/app";
  }
}

// ---------------------------------------------------------------------------
// Transizioni ammesse
// ---------------------------------------------------------------------------

/** Chi può portare un ordine da uno stato all'altro.
 *  Finora `ORDER_FLOW` serviva solo a disegnare la timeline: nessuno validava
 *  le transizioni, né il codice né il database. Un cliente poteva marcare
 *  "consegnato" un ordine mai ritirato.
 *
 *  L'admin resta libero: deve poter sistemare a mano una situazione bloccata.
 *  Corriere e lavanderia possono fare solo i passi del proprio mestiere. */
export type ActorRole = "admin" | "courier" | "partner";

const TRANSIZIONI: Record<Exclude<ActorRole, "admin">, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  courier: {
    pickup_scheduled: ["picked_up"],
    delivery_scheduled: ["out_for_delivery"],
    out_for_delivery: ["delivered", "delivery_failed"],
    delivery_failed: ["out_for_delivery"],
  },
  partner: {
    picked_up: ["at_laundry"],
    at_laundry: ["washing"],
    washing: ["ready"],
  },
};

export function canTransition(from: OrderStatus, to: OrderStatus, role: ActorRole): boolean {
  if (role === "admin") return from !== to;
  return (TRANSIZIONI[role][from] ?? []).includes(to);
}

/** Messaggio leggibile quando la transizione è rifiutata: al rider non serve
 *  sapere di stati e ruoli, gli serve sapere cosa fare. */
export function transitionError(from: OrderStatus, to: OrderStatus): string {
  return `Non puoi passare da "${ORDER_STATUS_LABEL[from] ?? from}" a "${ORDER_STATUS_LABEL[to] ?? to}". Ricarica la pagina: l'ordine potrebbe essere già stato aggiornato da qualcun altro.`;
}

// ---------------------------------------------------------------------------
// Foto prova
// ---------------------------------------------------------------------------

/** Il bucket `proofs` è privato (migration 0037): le foto scattate davanti alle
 *  case dei clienti non devono essere leggibili da chiunque abbia l'URL.
 *  In `order_items.photo_url` salviamo il path; qui lo trasformiamo in un link
 *  firmato a scadenza breve, e solo per chi la RLS autorizza a vedere.
 *  Le righe vecchie contenevano un URL pubblico completo: le riconosciamo dal
 *  prefisso http e le lasciamo passare invariate. */
export async function signedProofUrl(
  supabase: { storage: { from: (b: string) => { createSignedUrl: (p: string, s: number) => Promise<{ data: { signedUrl: string } | null }> } } },
  pathOrUrl: string | null,
  secondi = 300,
): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  const { data } = await supabase.storage.from("proofs").createSignedUrl(pathOrUrl, secondi);
  return data?.signedUrl ?? null;
}
