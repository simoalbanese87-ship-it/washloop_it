import { test } from "node:test";
import assert from "node:assert/strict";
import { partenzaDelGiro, haversineKm } from "./route.ts";

const ZANICA = { lat: 45.641553, lng: 9.6794857 };   // la lavanderia
const DEPOSITO = { lat: 45.4370615, lng: 9.2029218 }; // Via Pizzi, Milano

test("se si comincia con una consegna si parte dalla lavanderia", () => {
  assert.deepEqual(partenzaDelGiro(true, ZANICA, DEPOSITO), ZANICA);
});

test("se si comincia con un ritiro si parte dal deposito", () => {
  assert.deepEqual(partenzaDelGiro(false, ZANICA, DEPOSITO), DEPOSITO);
});

test("senza indirizzo della lavanderia si ripiega sul deposito, non si resta senza partenza", () => {
  assert.deepEqual(partenzaDelGiro(true, null, DEPOSITO), DEPOSITO);
});

test("senza deposito si usa comunque la lavanderia", () => {
  assert.deepEqual(partenzaDelGiro(false, ZANICA, null), ZANICA);
});

test("senza né l'una né l'altro non si inventa un punto di partenza", () => {
  assert.equal(partenzaDelGiro(true, null, null), null);
});

test("la lavanderia è davvero fuori Milano: la scelta della partenza conta", () => {
  // Se fossero vicine la distinzione sarebbe accademica. Non lo è: da Zanica
  // la fermata più vicina di Milano è un'altra rispetto a quella dal deposito.
  const d = haversineKm(ZANICA.lat, ZANICA.lng, DEPOSITO.lat, DEPOSITO.lng);
  assert.ok(d > 35, `attesi oltre 35 km, trovati ${d.toFixed(1)}`);
});
