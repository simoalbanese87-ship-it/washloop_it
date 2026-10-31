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
  assert.match(corpoInvito(null), /^Ti scriviamo/);
});

test("il corpo saluta e offre sempre la via privata", () => {
  const html = corpoInvito("Fabia");
  assert.match(html, /^Ciao Fabia, ti scriviamo/);
  assert.match(html, /mailto:info@washloop\.it/);
});
