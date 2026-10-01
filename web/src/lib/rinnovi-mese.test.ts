import { test } from "node:test";
import assert from "node:assert/strict";
import { rinnoviDelMese, meseRoma, type SubPerRinnovo } from "./rinnovi-mese.ts";

const ADESSO = Date.parse("2026-10-01T09:00:00.000Z");
const MESE = "2026-10";

const sub = (p: Partial<SubPerRinnovo> = {}): SubPerRinnovo => ({
  prezzoCents: 16000,
  periodEndIso: "2026-10-27T10:00:00.000Z",
  disdetto: false,
  ...p,
});

test("un rinnovo in arrivo questo mese conta", () => {
  assert.deepEqual(rinnoviDelMese([sub()], MESE, ADESSO), { totaleCents: 16000, quanti: 1 });
});

test("chi ha già disdetto non rinnova, quindi non conta", () => {
  // È l'unico modo in cui questa barra potrebbe promettere soldi che non
  // arriveranno: l'abbonamento è attivo oggi e finisce fra tre settimane.
  assert.deepEqual(rinnoviDelMese([sub({ disdetto: true })], MESE, ADESSO), { totaleCents: 0, quanti: 0 });
});

test("un addebito del mese prossimo non gonfia questo mese", () => {
  assert.deepEqual(rinnoviDelMese([sub({ periodEndIso: "2026-11-03T10:00:00.000Z" })], MESE, ADESSO), { totaleCents: 0, quanti: 0 });
});

test("un addebito già passato non si somma: o è incassato, o è fallito", () => {
  assert.deepEqual(rinnoviDelMese([sub({ periodEndIso: "2026-09-29T10:00:00.000Z" })], MESE, ADESSO), { totaleCents: 0, quanti: 0 });
  assert.deepEqual(rinnoviDelMese([sub({ periodEndIso: "2026-10-01T08:00:00.000Z" })], MESE, ADESSO), { totaleCents: 0, quanti: 0 });
});

test("senza data o senza prezzo non si indovina", () => {
  assert.deepEqual(rinnoviDelMese([sub({ periodEndIso: null })], MESE, ADESSO), { totaleCents: 0, quanti: 0 });
  assert.deepEqual(rinnoviDelMese([sub({ prezzoCents: 0 })], MESE, ADESSO), { totaleCents: 0, quanti: 0 });
});

test("più abbonamenti si sommano", () => {
  const r = rinnoviDelMese(
    [sub(), sub({ prezzoCents: 7000, periodEndIso: "2026-10-08T06:00:00.000Z" }), sub({ disdetto: true })],
    MESE,
    ADESSO,
  );
  assert.deepEqual(r, { totaleCents: 23000, quanti: 2 });
});

test("il mese è quello di Roma, non quello UTC", () => {
  // Il 31 ottobre alle 23:30 a Roma in UTC è ancora il 31 alle 21:30, ma il
  // 1° novembre alle 00:30 a Roma in UTC è il 31 ottobre: contarlo in ottobre
  // sposterebbe un addebito di un mese intero.
  assert.equal(meseRoma("2026-10-31T23:30:00.000Z"), "2026-11");
  assert.equal(meseRoma("2026-10-31T21:30:00.000Z"), "2026-10");
});
