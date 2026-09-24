import { test } from "node:test";
import assert from "node:assert/strict";
import { scegliTetto } from "./tetto-sacchi.ts";

test("l'accordo sull'abbonamento vince sul piano e sulla ricorrenza", () => {
  assert.equal(scegliTetto(2, 1, 1), 2);
});

test("senza accordo vale il piano, non la ricorrenza", () => {
  // Il caso di Giulia l'8 settembre: il rider aveva letto due tag, il piano
  // Small ne comprende uno. Vince il piano.
  assert.equal(scegliTetto(null, 1, 2), 1);
});

test("senza accordo e senza piano resta la ricorrenza", () => {
  // I tre abbonamenti a prezzo personalizzato prima del backfill.
  assert.equal(scegliTetto(null, null, 2), 2);
});

test("nessuna fonte: null, e null non è zero", () => {
  const t = scegliTetto(null, null, null);
  assert.equal(t, null);
  assert.notEqual(t, 0);
});

test("lo zero non azzera il tetto: si passa alla fonte dopo", () => {
  // È il caso che protegge i pagamenti: sacchiDaContare accetterebbe uno zero
  // come tetto valido e pagherebbe la lavanderia zero.
  assert.equal(scegliTetto(0, 1, 2), 1);
  assert.equal(scegliTetto(0, 0, 0), null);
});

test("numeri che non sono numeri di sacchi vengono ignorati", () => {
  assert.equal(scegliTetto(-1, 2, null), 2);
  assert.equal(scegliTetto(1.5, 2, null), 2);
  assert.equal(scegliTetto(NaN, 2, null), 2);
  assert.equal(scegliTetto(undefined, undefined, 3), 3);
});
