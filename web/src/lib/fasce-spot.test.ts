import { test } from "node:test";
import assert from "node:assert/strict";
import { daRiequilibrare, fineSettimana, scadenzaDi, scadenzaTesto } from "./fasce-spot.ts";

test("«questa settimana» finisce la domenica, non sette giorni dopo", () => {
  // Giovedì 22 ottobre 2026 → domenica 25.
  assert.equal(fineSettimana("2026-10-22"), "2026-10-25");
  // Lunedì → la domenica della stessa settimana.
  assert.equal(fineSettimana("2026-10-26"), "2026-11-01");
  // Di domenica, la settimana finisce oggi.
  assert.equal(fineSettimana("2026-10-25"), "2026-10-25");
});

test("«per sempre» non scrive una scadenza", () => {
  // È il modo di dire «questa è diventata calendario generale».
  assert.equal(scadenzaDi("sempre", "2026-10-22"), null);
});

test("«fino al» prende la data, e una data storta non vale", () => {
  assert.equal(scadenzaDi("data", "2026-10-22", "2026-12-31"), "2026-12-31");
  assert.equal(scadenzaDi("data", "2026-10-22", "31/12/2026"), null);
  assert.equal(scadenzaDi("data", "2026-10-22", ""), null);
  assert.equal(scadenzaDi("data", "2026-10-22", null), null);
});

test("una fascia del calendario generale non si riequilibra mai", () => {
  assert.equal(daRiequilibrare({ spot: false, vale_fino_al: null }, "2026-10-22"), false);
  assert.equal(daRiequilibrare({ spot: false, vale_fino_al: "2020-01-01" }, "2026-10-22"), false);
});

test("una spot scaduta va riequilibrata, una ancora valida no", () => {
  assert.equal(daRiequilibrare({ spot: true, vale_fino_al: "2026-10-21" }, "2026-10-22"), true);
  assert.equal(daRiequilibrare({ spot: true, vale_fino_al: "2026-10-22" }, "2026-10-22"), false);
  assert.equal(daRiequilibrare({ spot: true, vale_fino_al: "2026-11-30" }, "2026-10-22"), false);
});

test("una spot senza scadenza è il caso da non lasciar correre", () => {
  // È esattamente come il lunedì è diventato un giorno di ritiro: aperto per
  // un caso, mai più guardato.
  assert.equal(daRiequilibrare({ spot: true, vale_fino_al: null }, "2026-10-22"), true);
  assert.match(scadenzaTesto(null), /da decidere/);
  assert.equal(scadenzaTesto("2026-11-30"), "fino al 30/11/2026");
});
