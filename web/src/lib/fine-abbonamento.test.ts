import { test } from "node:test";
import assert from "node:assert/strict";
import { vaAvvisato, type RigaFine } from "./fine-abbonamento.ts";

const ADESSO = Date.parse("2026-10-01T09:00:00.000Z");
const fra = (ore: number) => new Date(ADESSO + ore * 3_600_000).toISOString();

const base: RigaFine = {
  status: "active",
  termina_dopo_settimane: 1,
  cancel_at_period_end: true,
  current_period_end: fra(48),
  fine_avviso_inviato_at: null,
};

test("due giorni prima della fine, l'avviso parte", () => {
  assert.equal(vaAvvisato(base, ADESSO), true);
});

test("la finestra copre un giro di cron intero", () => {
  assert.equal(vaAvvisato({ ...base, current_period_end: fra(36) }, ADESSO), true);
  assert.equal(vaAvvisato({ ...base, current_period_end: fra(60) }, ADESSO), true);
  assert.equal(vaAvvisato({ ...base, current_period_end: fra(35) }, ADESSO), false);
  assert.equal(vaAvvisato({ ...base, current_period_end: fra(61) }, ADESSO), false);
});

test("chi scade fra cinque giorni non si tocca", () => {
  assert.equal(vaAvvisato({ ...base, current_period_end: fra(120) }, ADESSO), false);
});

test("chi è già scaduto non riceve un avviso in ritardo", () => {
  assert.equal(vaAvvisato({ ...base, current_period_end: fra(-2) }, ADESSO), false);
});

test("un abbonamento normale non finisce: non va avvisato", () => {
  // È il caso che, sbagliato, manderebbe «il tuo abbonamento finisce» a chi
  // paga ogni mese: la disdetta più efficace che potremmo scrivere noi.
  assert.equal(vaAvvisato({ ...base, termina_dopo_settimane: null }, ADESSO), false);
});

test("senza disdetta programmata non si annuncia nessuna fine", () => {
  assert.equal(vaAvvisato({ ...base, cancel_at_period_end: false }, ADESSO), false);
  assert.equal(vaAvvisato({ ...base, cancel_at_period_end: null }, ADESSO), false);
});

test("chi è già stato avvisato non lo è due volte", () => {
  assert.equal(vaAvvisato({ ...base, fine_avviso_inviato_at: "2026-09-30T09:00:00.000Z" }, ADESSO), false);
});

test("stati che non sono «attivo» restano fuori", () => {
  for (const status of ["canceled", "past_due", "unpaid", "trialing", "incomplete"]) {
    assert.equal(vaAvvisato({ ...base, status }, ADESSO), false, status);
  }
});

test("senza data di fine non si inventa niente", () => {
  assert.equal(vaAvvisato({ ...base, current_period_end: null }, ADESSO), false);
});
