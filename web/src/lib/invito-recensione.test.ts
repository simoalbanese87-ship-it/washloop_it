import { test } from "node:test";
import assert from "node:assert/strict";
import { nomeDiCortesia, corpoInvito } from "./invito-recensione.ts";

test("il nome si riduce al primo pezzo, con la maiuscola", () => {
  assert.equal(nomeDiCortesia("fabia marconi"), "Fabia");
  assert.equal(nomeDiCortesia("Saverio Rodriguez "), "Saverio");
  assert.equal(nomeDiCortesia("Elvira"), "Elvira");
});

test("senza nome non si inventa un saluto vuoto", () => {
  assert.equal(nomeDiCortesia(null), null);
  assert.equal(nomeDiCortesia("   "), null);
  assert.match(corpoInvito(null), /^Siamo partiti/);
});

test("il corpo saluta e offre sempre la via privata", () => {
  const html = corpoInvito("Fabia");
  assert.match(html, /^Ciao Fabia, siamo partiti/);
  assert.match(html, /mailto:info@washloop\.it/);
});

test("non si dice che le recensioni sono zero: ce n'è una", () => {
  const html = corpoInvito("Fabia");
  assert.match(html, /una recensione sola/);
  assert.doesNotMatch(html, /nessuna recensione/);
});
