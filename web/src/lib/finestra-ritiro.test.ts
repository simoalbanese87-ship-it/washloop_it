import { test } from "node:test";
import assert from "node:assert/strict";
import { siPuoAncoraCambiare, scadenzaCambio, scadenzaDetta, ORE_PER_CAMBIARE } from "./finestra-ritiro.ts";

const RITIRO = "2026-11-03T07:30:00.000Z"; // martedì 3 novembre, 08:30 a Roma

test("la scadenza è ventiquattro ore prima del ritiro", () => {
  assert.equal(ORE_PER_CAMBIARE, 24);
  assert.equal(scadenzaCambio(RITIRO), "2026-11-02T07:30:00.000Z");
});

test("un giorno prima si può ancora, un minuto dopo no", () => {
  assert.equal(siPuoAncoraCambiare(RITIRO, new Date("2026-11-02T07:29:00.000Z")), true);
  assert.equal(siPuoAncoraCambiare(RITIRO, new Date("2026-11-02T07:31:00.000Z")), false);
});

test("la mezz'ora prima del giro è chiusa: è il caso da cui nasce la regola", () => {
  assert.equal(siPuoAncoraCambiare(RITIRO, new Date("2026-11-03T07:00:00.000Z")), false);
});

test("senza fascia non c'è nessuna scadenza da far valere", () => {
  // Gli ordini nati a mano senza fascia: negare per un dato che manca sarebbe
  // una penalità al cliente per un difetto nostro.
  assert.equal(siPuoAncoraCambiare(null), true);
  assert.equal(siPuoAncoraCambiare(undefined), true);
  assert.equal(scadenzaCambio(null), null);
});

test("una data scritta male non chiude la porta", () => {
  assert.equal(siPuoAncoraCambiare("non è una data"), true);
});

test("la scadenza si dice in ora italiana", () => {
  // Le 07:30 UTC del 2 novembre sono le 08:30 a Roma (ora solare).
  assert.equal(scadenzaDetta(RITIRO), "lunedì 2 novembre alle 08:30");
});
