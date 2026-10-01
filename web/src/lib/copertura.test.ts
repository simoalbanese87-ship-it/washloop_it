import { test } from "node:test";
import assert from "node:assert/strict";
import { capDiMilano, capComuneServito, esitoCap, capCoperto, formatoCapValido, CAP_MILANO } from "./copertura.ts";

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

test("le decine tonde non sono CAP di nessuno", () => {
  // Generando i CAP dall'intervallo venivano fuori anche questi quattro, e
  // finivano stampati sulle pagine pubbliche insieme a quelli veri. È il test
  // che impedisce di tornare all'intervallo «per semplificare».
  for (const c of ["20130", "20140", "20150", "20160"]) {
    assert.equal(capDiMilano(c), false, c);
    assert.equal(esitoCap(c), "fuori-zona", c);
    assert.ok(!CAP_MILANO.includes(c), c);
  }
});

test("i comuni dell'hinterland restano fuori: sono comuni, non Milano", () => {
  // Arluno ed Elvira a Bollate: si attivano lo stesso, ma il ritiro si
  // concorda — e il messaggio che leggono dipende da qui.
  assert.equal(esitoCap("20004"), "fuori-zona"); // Arluno
  assert.equal(esitoCap("20021"), "fuori-zona"); // Bollate
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

test("l'elenco dei CAP di Milano sono i 38 veri, estremi compresi", () => {
  assert.equal(CAP_MILANO.length, 38);
  assert.equal(CAP_MILANO[0], "20121");
  assert.equal(CAP_MILANO[CAP_MILANO.length - 1], "20162");
  // Ogni voce dell'elenco deve superare la regola che poi decide davvero:
  // due liste che divergono sarebbero una pagina che promette e un form che nega.
  assert.ok(CAP_MILANO.every((c) => esitoCap(c) === "in-zona"));
  // Nessun doppione: una lista scritta a mano è una lista che può averli.
  assert.equal(new Set(CAP_MILANO).size, CAP_MILANO.length);
});
