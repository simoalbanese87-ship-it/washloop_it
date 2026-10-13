import { test } from "node:test";
import assert from "node:assert/strict";
import { oreDiLavorazione, ORE_STIRO, ORE_LAVANDERIA } from "./turnaround.ts";

test("il solo stiro torna in 48 ore, e il piano non lo smuove", () => {
  assert.equal(oreDiLavorazione({ tipoServizio: "solo_stiro" }), ORE_STIRO);
  // Anche se per qualche motivo ha un piano collegato: lo stiro è stiro.
  assert.equal(oreDiLavorazione({ tipoServizio: "solo_stiro", orePiano: 72 }), 48);
});

test("gli altri servizi seguono il loro piano", () => {
  assert.equal(oreDiLavorazione({ tipoServizio: "lava_stira", orePiano: 48 }), 48);
  assert.equal(oreDiLavorazione({ tipoServizio: "solo_lavanderia", orePiano: 24 }), 24);
});

test("senza piano si cade sulle 72 ore, che è il caso storico", () => {
  assert.equal(oreDiLavorazione({}), ORE_LAVANDERIA);
  assert.equal(oreDiLavorazione({ tipoServizio: null, orePiano: null }), 72);
  // Un piano a zero o negativo è un dato sporco, non una promessa di consegna
  // istantanea: si ricade sul ripiego.
  assert.equal(oreDiLavorazione({ orePiano: 0 }), 72);
  assert.equal(oreDiLavorazione({ orePiano: -5 }), 72);
});

test("un tipo di servizio scritto male non accorcia i tempi per sbaglio", () => {
  assert.equal(oreDiLavorazione({ tipoServizio: "stiro", orePiano: 72 }), 72);
});
