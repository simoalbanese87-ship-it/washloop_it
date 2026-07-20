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
