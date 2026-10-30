import { test } from "node:test";
import assert from "node:assert/strict";
import { contoGettoni, fraseGettoni } from "./gettoni.ts";

test("chi non ha comprato niente ha un saldo a zero, non negativo", () => {
  assert.deepEqual(contoGettoni({}), { accreditati: 0, usati: 0, residui: 0, oltre: 0 });
  assert.equal(fraseGettoni(contoGettoni({})), null);
});

test("due comprati e uno usato lasciano un ritiro", () => {
  const c = contoGettoni({ accreditati: 2, usati: 1 });
  assert.equal(c.residui, 1);
  assert.equal(c.oltre, 0);
  assert.equal(fraseGettoni(c), "Ti resta 1 ritiro.");
});

test("chi li ha finiti lo legge scritto", () => {
  assert.equal(fraseGettoni(contoGettoni({ accreditati: 2, usati: 2 })), "Hai usato tutti i ritiri che hai comprato.");
});

test("chi ha fatto più ritiri dei gettoni non va in negativo", () => {
  // È il caso di Stefano prima del 30 ottobre: il numero da cui parte una
  // telefonata, non un saldo negativo da far vedere a qualcuno.
  const c = contoGettoni({ accreditati: 1, usati: 3 });
  assert.equal(c.residui, 0);
  assert.equal(c.oltre, 2);
});

test("numeri sporchi non diventano saldi", () => {
  assert.equal(contoGettoni({ accreditati: null, usati: null }).residui, 0);
  assert.equal(contoGettoni({ accreditati: -5, usati: 0 }).accreditati, 0);
  assert.equal(contoGettoni({ accreditati: 2.7, usati: 0 }).accreditati, 2);
});
