import { test } from "node:test";
import assert from "node:assert/strict";
import { settimanaRoma, settimanaOccupata, giornoEsteso } from "./settimana-roma.ts";

test("la settimana comincia di lunedì e finisce di domenica", () => {
  // 2–8 novembre 2026: lunedì 2, domenica 8.
  assert.equal(settimanaRoma("2026-11-02T08:00:00+01:00"), "2026-11-02");
  assert.equal(settimanaRoma("2026-11-04T08:30:00+01:00"), "2026-11-02");
  assert.equal(settimanaRoma("2026-11-08T23:00:00+01:00"), "2026-11-02");
  // Il lunedì dopo apre una settimana nuova.
  assert.equal(settimanaRoma("2026-11-09T00:30:00+01:00"), "2026-11-09");
});

test("il confine domenica/lunedì si conta in ora italiana, non in UTC", () => {
  // Le 00:30 di lunedì 9 a Roma sono le 23:30 di domenica 8 in UTC: contando
  // in UTC questo ritiro finirebbe nella settimana prima.
  assert.equal(settimanaRoma("2026-11-08T23:30:00.000Z"), "2026-11-09");
  // E le 23:30 di domenica 8 a Roma sono ancora la settimana del 2.
  assert.equal(settimanaRoma("2026-11-08T22:30:00.000Z"), "2026-11-02");
});

test("il cambio dell'ora legale non sposta nessuna settimana", () => {
  // L'ora solare arriva domenica 25 ottobre 2026: la settimana resta quella
  // del lunedì 19, prima e dopo il cambio.
  assert.equal(settimanaRoma("2026-10-24T08:00:00+02:00"), "2026-10-19");
  assert.equal(settimanaRoma("2026-10-25T08:00:00+01:00"), "2026-10-19");
  assert.equal(settimanaRoma("2026-10-26T08:00:00+01:00"), "2026-10-26");
});

test("una settimana a cavallo di due mesi resta una settimana sola", () => {
  // Lunedì 30 novembre → domenica 6 dicembre.
  assert.equal(settimanaRoma("2026-11-30T08:00:00+01:00"), "2026-11-30");
  assert.equal(settimanaRoma("2026-12-06T18:00:00+01:00"), "2026-11-30");
});

test("una settimana a cavallo di due anni resta una settimana sola", () => {
  // Lunedì 28 dicembre 2026 → domenica 3 gennaio 2027.
  assert.equal(settimanaRoma("2026-12-28T08:00:00+01:00"), "2026-12-28");
  assert.equal(settimanaRoma("2027-01-03T08:00:00+01:00"), "2026-12-28");
});

test("occupata dice sì solo per la settimana giusta", () => {
  const prese = ["2026-11-02"];
  assert.equal(settimanaOccupata(prese, "2026-11-04T08:30:00+01:00"), true);
  assert.equal(settimanaOccupata(prese, "2026-11-09T08:00:00+01:00"), false);
  assert.equal(settimanaOccupata([], "2026-11-04T08:30:00+01:00"), false);
});

test("il giorno si dice per esteso, in italiano", () => {
  assert.equal(giornoEsteso("2026-11-03T08:30:00+01:00"), "martedì 3 novembre");
});
