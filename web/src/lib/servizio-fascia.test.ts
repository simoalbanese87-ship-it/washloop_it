import { test } from "node:test";
import assert from "node:assert/strict";
import { fasciaPermessa, isServizioFascia } from "./servizio-fascia.ts";

test("una fascia senza servizio è di tutti: le riconsegne e quelle vecchie", () => {
  assert.equal(fasciaPermessa(null, "solo_stiro"), true);
  assert.equal(fasciaPermessa(undefined, "solo_lavanderia"), true);
  assert.equal(fasciaPermessa(null, null), true);
});

test("il mercoledì della stireria è solo di chi fa solo stiro", () => {
  assert.equal(fasciaPermessa("stiro", "solo_stiro"), true);
  // La lavanderia stira anche: il lava e stira sta tutto nel martedì, un sacco
  // solo lavato e stirato dallo stesso banco. Mandarlo anche al mercoledì
  // vorrebbe dire spaccare in due un servizio che è uno.
  assert.equal(fasciaPermessa("stiro", "lava_stira"), false);
  assert.equal(fasciaPermessa("stiro", "solo_lavanderia"), false);
});

test("il martedì della lavanderia non è di chi fa solo stiro", () => {
  assert.equal(fasciaPermessa("lavanderia", "solo_lavanderia"), true);
  assert.equal(fasciaPermessa("lavanderia", "lava_stira"), true);
  assert.equal(fasciaPermessa("lavanderia", "solo_stiro"), false);
});

test("chi non ha il servizio compilato conta come lavanderia", () => {
  // Sono i clienti storici: lasciarli fuori dal martedì vorrebbe dire chiudere
  // fuori quasi tutti, e farli entrare nel mercoledì vorrebbe dire mandare il
  // loro bucato in una stireria.
  assert.equal(fasciaPermessa("lavanderia", null), true);
  assert.equal(fasciaPermessa("stiro", null), false);
});

test("un valore inventato sulla fascia non blocca nessuno", () => {
  // Meglio una fascia di troppo che un cliente che non riesce a prenotare
  // perché qualcuno ha scritto male una parola in database.
  assert.equal(isServizioFascia("stireria"), false);
  assert.equal(fasciaPermessa("stireria", "solo_lavanderia"), true);
});
