import { test } from "node:test";
import assert from "node:assert/strict";
import { giornoDiCompetenza } from "./competenza-giorno.ts";

const RITIRO = "2026-09-29T06:30:00.000Z";
const RICONSEGNA = "2026-10-02T07:00:00.000Z";
const CREATO = "2026-09-20T10:00:00.000Z";
const OGGI = "2026-10-01";

test("un ordine a cavallo di fine mese vale il mese del ritiro", () => {
  // Il caso vero del 1° ottobre: tre ordini ritirati il 29 settembre e
  // riconsegnati il 2 ottobre finivano nel proforma di ottobre.
  assert.equal(giornoDiCompetenza(RITIRO, RICONSEGNA, CREATO, OGGI), "2026-09-29");
});

test("senza ritiro vale la riconsegna", () => {
  assert.equal(giornoDiCompetenza(null, RICONSEGNA, CREATO, OGGI), "2026-10-02");
});

test("senza fasce vale la data dell'ordine", () => {
  assert.equal(giornoDiCompetenza(null, null, CREATO, OGGI), "2026-09-20");
});

test("senza niente resta oggi: una riga senza periodo non si controlla", () => {
  assert.equal(giornoDiCompetenza(null, null, null, OGGI), "2026-10-01");
});

test("sacchi e capi dello stesso ordine cadono sempre insieme", () => {
  // Le due righe nascono in giorni diversi, ma la data di competenza la
  // decidono gli stessi tre valori: non possono separarsi.
  const capi = giornoDiCompetenza(RITIRO, RICONSEGNA, CREATO, "2026-09-30");
  const sacchi = giornoDiCompetenza(RITIRO, RICONSEGNA, CREATO, "2026-10-02");
  assert.equal(capi, sacchi);
});
