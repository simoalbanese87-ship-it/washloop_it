import { test } from "node:test";
import assert from "node:assert/strict";
import { scegliRider } from "./rider-predefinito.ts";

const MERYL = "meryl";
const LUCA = "luca";

test("il rider della zona vince sempre", () => {
  assert.equal(scegliRider(MERYL, [LUCA, LUCA]), MERYL);
});

test("indirizzo senza zona: se l'unica zona attiva ha un rider, è lui", () => {
  assert.equal(scegliRider(null, [MERYL]), MERYL);
});

test("più zone attive, stesso rider su tutte: è lui", () => {
  assert.equal(scegliRider(null, [MERYL, MERYL]), MERYL);
});

test("zone attive con rider diversi: decide l'ops, non il codice", () => {
  assert.equal(scegliRider(null, [MERYL, LUCA]), null);
});

test("una zona attiva scoperta: non si indovina", () => {
  assert.equal(scegliRider(null, [MERYL, null]), null);
});

test("nessuna zona attiva: niente da cui dedurre", () => {
  assert.equal(scegliRider(null, []), null);
});
