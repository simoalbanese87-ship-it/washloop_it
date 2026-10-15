import { test } from "node:test";
import assert from "node:assert/strict";
import { variazionePercentuale, etichettaVariazione } from "./variazione.ts";

test("la crescita e il calo si misurano sul mese prima", () => {
  assert.equal(variazionePercentuale(59200, 25000), 137);
  assert.equal(variazionePercentuale(25000, 59200), -58);
  assert.equal(variazionePercentuale(76700, 59200), 30);
});

test("da zero non si cresce di una percentuale", () => {
  assert.equal(variazionePercentuale(50000, 0), null);
  assert.equal(variazionePercentuale(50000, null), null);
  assert.equal(variazionePercentuale(50000, undefined), null);
  // Un mese precedente negativo non esiste: è un dato sporco, non un confronto.
  assert.equal(variazionePercentuale(50000, -100), null);
});

test("scendere a zero resta un calo del 100%", () => {
  assert.equal(variazionePercentuale(0, 20000), -100);
});

test("l'etichetta dice il verso, e tace quando non c'è confronto", () => {
  assert.deepEqual(etichettaVariazione(30), { testo: "+30%", verso: "su" });
  assert.deepEqual(etichettaVariazione(-58), { testo: "−58%", verso: "giu" });
  assert.equal(etichettaVariazione(null), null);
});

test("un movimento sotto l'1% è lo stesso mese, non una crescita", () => {
  assert.deepEqual(etichettaVariazione(0), { testo: "=", verso: "pari" });
  // 601 € contro 600 €: arrotonda a 0, e si scrive «=».
  assert.deepEqual(etichettaVariazione(variazionePercentuale(60100, 60000)), { testo: "=", verso: "pari" });
});
