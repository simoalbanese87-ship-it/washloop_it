import { test } from "node:test";
import assert from "node:assert/strict";
import { passiMancanti, PASSO_TESTO } from "./passi-mancanti.ts";

test("chi ha tutto non ha passi da fare", () => {
  assert.deepEqual(passiMancanti({ abbonamentoAttivo: true, haIndirizzo: true }), []);
});

test("manca solo l'indirizzo", () => {
  assert.deepEqual(passiMancanti({ abbonamentoAttivo: true, haIndirizzo: false }), ["indirizzo"]);
});

test("manca solo l'abbonamento", () => {
  assert.deepEqual(passiMancanti({ abbonamentoAttivo: false, haIndirizzo: true }), ["abbonamento"]);
});

test("mancano entrambi: si dicono entrambi, l'abbonamento per primo", () => {
  // È il caso che prima veniva raccontato come «manca solo l'indirizzo»: la
  // persona lo metteva, tornava, e scopriva che doveva anche pagare.
  assert.deepEqual(passiMancanti({ abbonamentoAttivo: false, haIndirizzo: false }), ["abbonamento", "indirizzo"]);
});

test("ogni passo ha un testo e una destinazione: nessun vicolo cieco", () => {
  for (const p of passiMancanti({ abbonamentoAttivo: false, haIndirizzo: false })) {
    const t = PASSO_TESTO[p];
    assert.ok(t.titolo && t.dettaglio && t.azione);
    assert.ok(t.href.startsWith("/app/"));
  }
});
