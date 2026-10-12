import { test } from "node:test";
import assert from "node:assert/strict";
import { scegliLavanderia } from "./lavanderia-scelta.ts";

const GENERALE = "lav-generale";
const STIRERIA = "lav-stireria";

test("il servizio a sacco vince su tutto: quel lavoro lo fa solo lui", () => {
  assert.equal(
    scegliLavanderia({ servizio: STIRERIA, fascia: GENERALE, generali: [GENERALE] }),
    STIRERIA,
  );
});

test("senza servizio vince la fascia: l'ha scelta una persona", () => {
  assert.equal(scegliLavanderia({ fascia: GENERALE, generali: [GENERALE, "altra"] }), GENERALE);
});

test("senza servizio e senza fascia resta il ripiego, se la generale è una sola", () => {
  assert.equal(scegliLavanderia({ generali: [GENERALE] }), GENERALE);
});

test("la stireria non entra nel conto delle generali", () => {
  // È il punto per cui questo modulo esiste: con due lavanderie attive, di cui
  // una dedicata al solo stiro, il ripiego storico avrebbe risposto `null` e
  // gli ordini sarebbero nati senza lavanderia.
  assert.equal(scegliLavanderia({ generali: [GENERALE] }), GENERALE);
  assert.equal(scegliLavanderia({ generali: [GENERALE, "seconda-generale"] }), null);
});

test("niente da nessuna parte: null, e decide una persona", () => {
  assert.equal(scegliLavanderia({ generali: [] }), null);
  assert.equal(scegliLavanderia({ servizio: "  ", fascia: "", generali: [] }), null);
});
