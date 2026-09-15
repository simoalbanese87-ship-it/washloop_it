import { test } from "node:test";
import assert from "node:assert/strict";
import { conteggiaConFranchigia, sacchiPerFranchigia, ridistribuisciFranchigia } from "./franchigia.ts";

test("il caso Giulia: 3 camicie in 1 sacco sono tutte incluse", () => {
  const c = conteggiaConFranchigia(3, 3, 1);
  assert.equal(c.daAddebitare, 0);
  assert.equal(c.incluse, 3);
});

test("il caso fabia: 2 sacchi danno 6 camicie di franchigia", () => {
  assert.equal(conteggiaConFranchigia(6, 3, 2).daAddebitare, 0);
  assert.equal(conteggiaConFranchigia(7, 3, 2).daAddebitare, 1);
});

test("dalla quarta in poi, con un sacco, si paga", () => {
  const c = conteggiaConFranchigia(5, 3, 1);
  assert.equal(c.daAddebitare, 2);
  assert.equal(c.incluse, 3);
});

test("la franchigia non si usa due volte se si registra in due riprese", () => {
  // Prima registrazione: 2 camicie, tutte incluse (franchigia 3).
  const primo = conteggiaConFranchigia(2, 3, 1);
  assert.equal(primo.daAddebitare, 0);
  // Seconda: altre 3. Ne resta 1 di franchigia, quindi se ne pagano 2.
  const secondo = conteggiaConFranchigia(3, 3, 1, 2);
  assert.equal(secondo.daAddebitare, 2);
  assert.equal(secondo.incluse, 1);
});

test("i capi senza franchigia si addebitano tutti", () => {
  const c = conteggiaConFranchigia(2, 0, 3);
  assert.equal(c.daAddebitare, 2);
  assert.equal(c.franchigiaTotale, 0);
});

test("numeri strani non producono addebiti strani", () => {
  assert.equal(conteggiaConFranchigia(-5, 3, 1).daAddebitare, 0);
  assert.equal(conteggiaConFranchigia(2, 3, 0).daAddebitare, 0, "zero sacchi conta comunque come uno");
  assert.equal(conteggiaConFranchigia(4, 3, 1, 99).daAddebitare, 4, "franchigia esaurita: si paga tutto");
});

test("i sacchi contati dalla lavanderia vincono su tutto", () => {
  assert.equal(sacchiPerFranchigia(1, 2, 3), 1);
});

test("senza conteggio si usa quello del rider, non il previsto", () => {
  // Il caso del 15 settembre: 2 previsti, 1 scansionato, 6 camicie.
  assert.equal(sacchiPerFranchigia(null, 1, 2), 1);
  assert.equal(conteggiaConFranchigia(6, 3, sacchiPerFranchigia(null, 1, 2)).daAddebitare, 3);
});

test("nessun tag letto non vuol dire nessun sacco: si ripiega sul previsto", () => {
  assert.equal(sacchiPerFranchigia(null, 0, 2), 2);
});

test("zero sacchi contati è una risposta, non un vuoto", () => {
  assert.equal(sacchiPerFranchigia(0, 2, 2), 0);
});

test("la franchigia si ridistribuisce a chi è arrivato prima", () => {
  const out = ridistribuisciFranchigia([{ id: "a", qtyTotale: 6 }], 3);
  assert.deepEqual(out, [{ id: "a", incluse: 3, daAddebitare: 3 }]);
});

test("più righe: la franchigia si consuma in ordine di registrazione", () => {
  const out = ridistribuisciFranchigia([{ id: "a", qtyTotale: 2 }, { id: "b", qtyTotale: 4 }], 3);
  assert.deepEqual(out, [
    { id: "a", incluse: 2, daAddebitare: 0 },
    { id: "b", incluse: 1, daAddebitare: 3 },
  ]);
});

test("più sacchi confermati: quello che era da pagare torna compreso", () => {
  const out = ridistribuisciFranchigia([{ id: "a", qtyTotale: 6 }], 6);
  assert.deepEqual(out, [{ id: "a", incluse: 6, daAddebitare: 0 }]);
});
