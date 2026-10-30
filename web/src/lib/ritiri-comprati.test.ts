import { test } from "node:test";
import assert from "node:assert/strict";
import { contoRitiri, fraseRitiri } from "./ritiri-comprati.ts";

test("chi non ha comprato niente ha un saldo a zero, non negativo", () => {
  assert.deepEqual(contoRitiri({}), { accreditati: 0, usati: 0, residui: 0, oltre: 0 });
  assert.equal(fraseRitiri(contoRitiri({})), null);
});

test("due comprati e uno usato lasciano un ritiro", () => {
  const c = contoRitiri({ accreditati: 2, usati: 1 });
  assert.equal(c.residui, 1);
  assert.equal(c.oltre, 0);
  assert.equal(fraseRitiri(c), "Gli resta 1 ritiro.");
});

test("chi li ha finiti lo legge scritto", () => {
  assert.equal(fraseRitiri(contoRitiri({ accreditati: 2, usati: 2 })), "Ha usato tutti i ritiri che ha.");
});

test("chi ha fatto più ritiri di quelli che aveva non va in negativo", () => {
  // È il caso di Stefano prima del 30 ottobre: il numero da cui parte una
  // telefonata, non un saldo negativo da far vedere a qualcuno.
  const c = contoRitiri({ accreditati: 1, usati: 3 });
  assert.equal(c.residui, 0);
  assert.equal(c.oltre, 2);
});

test("numeri sporchi non diventano saldi", () => {
  assert.equal(contoRitiri({ accreditati: null, usati: null }).residui, 0);
  assert.equal(contoRitiri({ accreditati: -5, usati: 0 }).accreditati, 0);
  assert.equal(contoRitiri({ accreditati: 2.7, usati: 0 }).accreditati, 2);
});
