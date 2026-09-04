import { test } from "node:test";
import assert from "node:assert/strict";
import { scorpora, ALIQUOTA_IVA } from "./iva.ts";

test("un sacco da 15 € ivati: imponibile 12,30 e IVA 2,70", () => {
  const s = scorpora(1500);
  assert.equal(s.imponibile, 1230);
  assert.equal(s.iva, 270);
  assert.equal(s.lordo, 1500);
});

test("imponibile e IVA rifanno sempre esattamente il lordo", () => {
  // È la proprietà che conta su un proforma: se la somma non torna alla cifra
  // concordata, il documento torna indietro. Arrotondare le due voci in modo
  // indipendente rompe proprio questo.
  for (let c = 1; c <= 5000; c++) {
    const s = scorpora(c);
    assert.equal(s.imponibile + s.iva, c, `non quadra su ${c} centesimi`);
  }
});

test("l'IVA non si arrotonda per conto suo", () => {
  // 15,01 € lordi: imponibile 12,30, IVA 2,71. Arrotondando l'IVA a partire
  // dall'imponibile (12,30 × 22% = 2,706 → 2,71) qui torna, ma su altri importi
  // no: il test sopra copre i cinquemila casi.
  const s = scorpora(1501);
  assert.equal(s.imponibile + s.iva, 1501);
});

test("zero resta zero", () => {
  assert.deepEqual(scorpora(0), { imponibile: 0, iva: 0, lordo: 0 });
});

test("l'aliquota si può cambiare senza toccare la funzione", () => {
  assert.equal(ALIQUOTA_IVA, 22);
  const s = scorpora(1000, 10);
  assert.equal(s.imponibile, 909);
  assert.equal(s.iva, 91);
});
