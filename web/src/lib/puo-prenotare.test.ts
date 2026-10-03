import { test } from "node:test";
import assert from "node:assert/strict";
import { puoPrenotare, abbonamentoVivo, perchePuoNonPrenotare } from "./puo-prenotare.ts";

test("un abbonato attivo prenota", () => {
  assert.equal(puoPrenotare({ statoAbbonamento: "active" }), true);
  assert.equal(puoPrenotare({ statoAbbonamento: "trialing" }), true);
});

test("il cliente a consumo prenota anche senza abbonamento", () => {
  // È il punto: «deve poter prenotare come gli altri, quando vuole».
  assert.equal(puoPrenotare({ statoAbbonamento: null, aConsumo: true }), true);
  assert.equal(perchePuoNonPrenotare({ aConsumo: true }), null);
});

test("chi non ha niente non prenota", () => {
  assert.equal(puoPrenotare({}), false);
  assert.equal(puoPrenotare({ statoAbbonamento: null, aConsumo: false }), false);
});

test("un ex cliente non diventa a consumo per il fatto di essere ex", () => {
  // La differenza fra un cliente a consumo e un ex cliente non sta nei dati:
  // sta in un accordo, e l'accordo è il flag.
  assert.equal(puoPrenotare({ statoAbbonamento: "canceled" }), false);
  assert.equal(puoPrenotare({ statoAbbonamento: "incomplete" }), false);
});

test("chi ha una fattura aperta legge perché, non «serve un abbonamento»", () => {
  assert.equal(perchePuoNonPrenotare({ statoAbbonamento: "past_due" }), "C'è una fattura rimasta aperta: appena è saldata torni a prenotare.");
  assert.equal(perchePuoNonPrenotare({ statoAbbonamento: "unpaid" })?.startsWith("C'è una fattura"), true);
});

test("a consumo vince anche su un abbonamento scaduto", () => {
  // Chi passa da abbonato a consumo non deve restare bloccato dalla riga vecchia.
  assert.equal(puoPrenotare({ statoAbbonamento: "canceled", aConsumo: true }), true);
});

test("abbonamentoVivo non si fa ingannare da uno stato vuoto", () => {
  assert.equal(abbonamentoVivo(null), false);
  assert.equal(abbonamentoVivo(""), false);
  assert.equal(abbonamentoVivo("active"), true);
});
