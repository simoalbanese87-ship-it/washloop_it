import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransition, ordineAperto, ORDER_STATUS_LABEL, STATI_CHIUSI, type OrderStatus } from "./orders.ts";

/** Primi test del progetto. Coprono la tabella delle transizioni, che è la cosa
 *  che prima non esisteva: chiunque poteva portare un ordine a qualunque stato.
 *  Si eseguono con `npm test` (Node esegue TypeScript nativamente). */

test("il rider può fare solo i passi del suo mestiere", () => {
  assert.ok(canTransition("pickup_scheduled", "picked_up", "courier"));
  assert.ok(canTransition("delivery_scheduled", "out_for_delivery", "courier"));
  assert.ok(canTransition("out_for_delivery", "delivered", "courier"));
  assert.ok(canTransition("out_for_delivery", "delivery_failed", "courier"));
});

test("il rider non salta le fasi", () => {
  // Il caso che ha motivato tutto: marcare consegnato un ordine mai ritirato.
  assert.ok(!canTransition("pickup_scheduled", "delivered", "courier"));
  assert.ok(!canTransition("requested", "completed", "courier"));
  assert.ok(!canTransition("washing", "ready", "courier"), "il lavaggio è mestiere della lavanderia");
});

test("la lavanderia muove solo la lavorazione", () => {
  assert.ok(canTransition("picked_up", "at_laundry", "partner"));
  assert.ok(canTransition("at_laundry", "washing", "partner"));
  assert.ok(canTransition("washing", "ready", "partner"));
  assert.ok(!canTransition("ready", "delivered", "partner"), "la consegna non la fa la lavanderia");
  assert.ok(!canTransition("pickup_scheduled", "picked_up", "partner"), "il ritiro non lo fa la lavanderia");
});

test("una consegna fallita si può ritentare", () => {
  assert.ok(canTransition("delivery_failed", "out_for_delivery", "courier"));
});

test("l'admin può sbloccare qualsiasi situazione, ma non verso lo stesso stato", () => {
  assert.ok(canTransition("requested", "cancelled", "admin"));
  assert.ok(canTransition("washing", "pickup_scheduled", "admin"), "deve poter tornare indietro a mano");
  assert.ok(!canTransition("washing", "washing", "admin"));
});

test("gli stati finali non vanno da nessuna parte per rider e lavanderia", () => {
  for (const finale of ["delivered", "completed", "cancelled"] as OrderStatus[]) {
    for (const ruolo of ["courier", "partner"] as const) {
      for (const dest of ["picked_up", "ready", "out_for_delivery"] as OrderStatus[]) {
        assert.ok(!canTransition(finale, dest, ruolo), `${ruolo}: ${finale} → ${dest} non deve passare`);
      }
    }
  }
});

test("ogni stato ha un'etichetta in italiano", () => {
  const stati: OrderStatus[] = [
    "requested", "pickup_scheduled", "picked_up", "at_laundry", "washing", "ready",
    "delivery_scheduled", "out_for_delivery", "delivered", "delivery_failed", "completed", "cancelled",
  ];
  for (const s of stati) {
    assert.ok(ORDER_STATUS_LABEL[s], `manca l'etichetta per ${s}`);
  }
});

test("un ordine è aperto finché non è consegnato, completato o annullato", () => {
  for (const s of ["requested", "pickup_scheduled", "washing", "ready", "delivery_scheduled", "delivery_failed"] as OrderStatus[]) {
    assert.equal(ordineAperto(s), true, `${s} dovrebbe risultare aperto`);
  }
  for (const s of ["delivered", "completed", "cancelled"] as OrderStatus[]) {
    assert.equal(ordineAperto(s), false, `${s} dovrebbe risultare chiuso`);
  }
});

test("una consegna non riuscita resta aperta: c'è ancora da fare qualcosa", () => {
  // Non sta in ORDER_FLOW, quindi è facile dimenticarsene: il bucato è ancora
  // in giro e il cliente va richiamato.
  assert.equal(STATI_CHIUSI.includes("delivery_failed"), false);
});
