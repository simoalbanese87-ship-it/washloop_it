import { test } from "node:test";
import assert from "node:assert/strict";
import { capDiMilano, capComuneServito, esitoCap, capCoperto, formatoCapValido } from "./copertura.ts";

test("i CAP di Milano città sono tutti accettati, non solo quelli del giro", () => {
  assert.equal(capDiMilano("20121"), true); // primo
  assert.equal(capDiMilano("20162"), true); // ultimo
  assert.equal(capDiMilano("20143"), true); // la nostra sede
  assert.equal(capDiMilano("20159"), true); // Isola: fuori dal giro, dentro Milano
});

test("il 20100 generico vale: sta ancora su molti moduli", () => {
  assert.equal(capDiMilano("20100"), true);
});

test("fuori dall'intervallo non è Milano città", () => {
  assert.equal(capDiMilano("20120"), false);
  assert.equal(capDiMilano("20163"), false);
  assert.equal(capDiMilano("00100"), false); // Roma
});

test("i comuni serviti passano per scelta, non per intervallo", () => {
  assert.equal(capDiMilano("20089"), false); // Rozzano non è Milano città
  assert.equal(capComuneServito("20089"), true);
  assert.equal(esitoCap("20089"), "in-zona");
  assert.equal(esitoCap("20090"), "in-zona");
});

test("un CAP lontano resta fuori zona: il lead si prende comunque, la promessa no", () => {
  assert.equal(esitoCap("00100"), "fuori-zona");
  assert.equal(capCoperto("00100"), false);
});

test("formato: cinque cifre, niente lettere e niente spazi in mezzo", () => {
  assert.equal(formatoCapValido("20143"), true);
  assert.equal(formatoCapValido("2014"), false);
  assert.equal(formatoCapValido("201a3"), false);
  assert.equal(formatoCapValido(" 20143 "), true); // gli spazi ai bordi si tolgono
});

test("gli spazi ai bordi non cambiano l'esito", () => {
  assert.equal(esitoCap(" 20143 "), "in-zona");
});
