import { test } from "node:test";
import assert from "node:assert/strict";
import { nomeDiCortesia, corpoInvito, aParole } from "./invito-recensione.ts";

const NOVE = { sacchi: 9, meseDiPartenza: "settembre" };

test("il nome si riduce al primo pezzo, con la maiuscola", () => {
  assert.equal(nomeDiCortesia("fabia marconi"), "Fabia");
  assert.equal(nomeDiCortesia("Saverio Rodriguez "), "Saverio");
  assert.equal(nomeDiCortesia("Elvira"), "Elvira");
});

test("senza nome non si inventa un saluto vuoto", () => {
  assert.equal(nomeDiCortesia(null), null);
  assert.equal(nomeDiCortesia("   "), null);
  assert.match(corpoInvito(null, NOVE), /^Da settembre abbiamo/);
});

test("l'apertura sono i suoi numeri, scritti a parole", () => {
  assert.match(corpoInvito("Fabia", NOVE), /^Ciao Fabia, da settembre abbiamo ritirato e riportato <strong>nove sacchi<\/strong> tuoi\./);
});

test("un sacco solo non diventa «un sacchi»", () => {
  const html = corpoInvito("Emanuela", { sacchi: 1, meseDiPartenza: "ottobre" });
  assert.match(html, /ti abbiamo ritirato e riportato il primo sacco/);
  assert.doesNotMatch(html, /sacchi/);
});

test("senza numeri l'email regge lo stesso", () => {
  const html = corpoInvito("Elvira", { sacchi: 0, meseDiPartenza: null });
  assert.match(html, /^Ciao Elvira, ritiriamo e riportiamo il tuo bucato\./);
});

test("si chiede una cosa sola: niente stelle, niente sconti, niente reclami", () => {
  const html = corpoInvito("Fabia", NOVE);
  assert.match(html, /trenta secondi/);
  assert.match(html, /Le leggiamo tutte/);
  assert.doesNotMatch(html, /stell|sconto|codice|non ha funzionato|mailto/i);
});

test("i numeri piccoli si scrivono a parole, i grandi in cifre", () => {
  assert.equal(aParole(1), "un");
  assert.equal(aParole(9), "nove");
  assert.equal(aParole(20), "venti");
  assert.equal(aParole(21), "21");
});
