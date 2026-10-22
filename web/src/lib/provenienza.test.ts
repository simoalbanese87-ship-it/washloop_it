import { test } from "node:test";
import assert from "node:assert/strict";
import { PROVENIENZE, provenienzaDove, provenienzaInEvidenza, provenienzaNome } from "./provenienza.ts";

test("«custom» si legge «Su misura», non «custom»", () => {
  // In pannello compariva «da custom»: una parola che non vuol dire niente
  // per chi deve decidere chi richiamare.
  assert.equal(provenienzaNome("custom"), "Su misura");
  assert.match(provenienzaDove("custom")!, /prezzi/);
});

test("ogni provenienza dice anche da dove è entrata", () => {
  for (const [k, p] of Object.entries(PROVENIENZE)) {
    assert.ok(p.nome.length > 2, `nome mancante per ${k}`);
    assert.ok(p.dove.length > 5, `origine mancante per ${k}`);
  }
});

test("una provenienza sconosciuta si mostra com'è, non sparisce", () => {
  // Meglio una parola tecnica di una riga vuota: vuota fa pensare che il
  // contatto non abbia una provenienza.
  assert.equal(provenienzaNome("instagram"), "instagram");
  assert.equal(provenienzaDove("instagram"), "instagram");
});

test("niente provenienza resta niente", () => {
  assert.equal(provenienzaNome(null), null);
  assert.equal(provenienzaNome(""), null);
  assert.equal(provenienzaDove(undefined), null);
});

test("solo il su misura salta all'occhio", () => {
  // Chi ha scritto cosa gli serve e aspetta una telefonata non è un indirizzo
  // lasciato di passaggio.
  assert.equal(provenienzaInEvidenza("custom"), true);
  assert.equal(provenienzaInEvidenza("landing"), false);
  assert.equal(provenienzaInEvidenza(null), false);
});
