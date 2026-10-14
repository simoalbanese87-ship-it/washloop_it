import { test } from "node:test";
import assert from "node:assert/strict";
import { servizioDopoAbbonamento } from "./piano-servizio.ts";

test("chi paga il piano dello stiro diventa solo stiro, qualunque cosa facesse prima", () => {
  assert.equal(servizioDopoAbbonamento("stiro", null), "solo_stiro");
  assert.equal(servizioDopoAbbonamento("stiro", "lava_stira"), "solo_stiro");
  assert.equal(servizioDopoAbbonamento("stiro", "solo_lavanderia"), "solo_stiro");
});

test("se è già solo stiro non si riscrive niente", () => {
  assert.equal(servizioDopoAbbonamento("stiro", "solo_stiro"), null);
});

test("un piano di lavanderia riempie il servizio solo se è vuoto", () => {
  assert.equal(servizioDopoAbbonamento("lavanderia", null), "lava_stira");
  assert.equal(servizioDopoAbbonamento(null, undefined), "lava_stira");
  // Accordi scritti a mano dall'ops: un rinnovo mensile non li cancella.
  assert.equal(servizioDopoAbbonamento("lavanderia", "solo_lavanderia"), null);
  assert.equal(servizioDopoAbbonamento("lavanderia", "lava_stira"), null);
  // Nemmeno quello di chi è passato allo stiro e tiene un piano vecchio: lo
  // cambia una persona dalla scheda, non il webhook del rinnovo.
  assert.equal(servizioDopoAbbonamento("lavanderia", "solo_stiro"), null);
});
