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
  at_laundry: "In lavanderia",
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

export type UserRole = "customer" | "courier" | "partner" | "admin";

/** Home di destinazione dopo il login, per ruolo. */
export function roleHome(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "courier":
      return "/courier";
    case "partner":
      return "/admin"; // partner usa la dashboard ops filtrata
    default:
      return "/app";
  }
}
