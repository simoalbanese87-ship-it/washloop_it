import { test } from "node:test";
import assert from "node:assert/strict";
import { cicloCorrente, contoPassaggi, frasePassaggi } from "./passaggi-inclusi.ts";

test("il ciclo è il mese che finisce alla data di rinnovo", () => {
  const c = cicloCorrente("2026-11-14T18:01:26.000Z");
  assert.equal(c?.dalIso, "2026-10-14T18:01:26.000Z");
  assert.equal(c?.alIso, "2026-11-14T18:01:26.000Z");
});

test("un mese corto non fa traboccare il ciclo nel mese dopo", () => {
  // 31 marzo meno un mese: senza correzione JavaScript dà il 3 marzo.
  const c = cicloCorrente("2027-03-31T08:00:00.000Z");
  assert.equal(c?.dalIso, "2027-02-28T08:00:00.000Z");
});

test("senza data di rinnovo non c'è un ciclo da contare", () => {
  assert.equal(cicloCorrente(null), null);
  assert.equal(cicloCorrente(undefined), null);
  assert.equal(cicloCorrente("non è una data"), null);
});

test("senza tetto non cambia niente: è il caso di tutti gli abbonamenti storici", () => {
  const c = contoPassaggi({ usati: 7 });
  assert.deepEqual(c, { spettanti: null, usati: 7, residui: null, oltre: 0 });
  assert.equal(frasePassaggi(c), null);
  // Zero o negativo è un campo compilato male, non un abbonamento senza ritiri.
  assert.equal(contoPassaggi({ perCiclo: 0, usati: 1 }).spettanti, null);
  assert.equal(contoPassaggi({ perCiclo: -2, usati: 1 }).spettanti, null);
});

test("due passaggi al mese, uno usato: ne resta uno", () => {
  const c = contoPassaggi({ perCiclo: 2, usati: 1 });
  assert.deepEqual(c, { spettanti: 2, usati: 1, residui: 1, oltre: 0 });
  assert.equal(frasePassaggi(c, "2026-11-14T18:01:26.000Z"), "1 di 2 · ne resta 1 entro il 14/11.");
});

test("i riportati si sommano al diritto del ciclo", () => {
  const c = contoPassaggi({ perCiclo: 2, riportati: 1, usati: 1 });
  assert.equal(c.spettanti, 3);
  assert.equal(c.residui, 2);
});

test("chi sfora non va in negativo: lo sforo si conta a parte", () => {
  const c = contoPassaggi({ perCiclo: 2, usati: 3 });
  assert.equal(c.residui, 0);
  assert.equal(c.oltre, 1);
  assert.match(frasePassaggi(c) ?? "", /oltre il piano/);
});

test("finiti tutti, si dice che sono finiti", () => {
  const c = contoPassaggi({ perCiclo: 2, usati: 2 });
  assert.equal(c.residui, 0);
  assert.equal(c.oltre, 0);
  assert.equal(frasePassaggi(c, "2026-11-14T18:01:26.000Z"), "2 di 2: li hai usati tutti entro il 14/11.");
});
