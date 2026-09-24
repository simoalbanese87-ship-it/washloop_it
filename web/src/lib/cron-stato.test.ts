import { test } from "node:test";
import assert from "node:assert/strict";
import { statoAutomazioni, quanteDaGuardare, JOBS } from "./cron-stato.ts";

const ORA = 3600_000;
const ADESSO = Date.parse("2026-09-25T09:00:00.000Z");
const giro = (job: string, oreFa: number, ok: boolean | null = true) => ({
  job,
  started_at: new Date(ADESSO - oreFa * ORA).toISOString(),
  ok,
  riassunto: null,
  errore: null,
});

test("un lavoro girato stanotte non è in ritardo", () => {
  const s = statoAutomazioni([giro("recurring", 3)], ADESSO);
  const r = s.find((x) => x.nome === "recurring")!;
  assert.equal(r.inRitardo, false);
  assert.equal(r.fallito, false);
  assert.equal(Math.round(r.oreFa!), 3);
});

test("un giorno saltato si vede", () => {
  const r = statoAutomazioni([giro("recurring", 30)], ADESSO).find((x) => x.nome === "recurring")!;
  assert.equal(r.inRitardo, true);
});

test("un'ora di ritardo non è un guasto: la coda di Vercel non si reclama", () => {
  const r = statoAutomazioni([giro("recurring", 25)], ADESSO).find((x) => x.nome === "recurring")!;
  assert.equal(r.inRitardo, false);
});

test("mai girato conta come in ritardo, non come «non lo sappiamo»", () => {
  // È il caso per cui questo registro esiste: i due cron rimasti muti per
  // settimane non producevano errori, semplicemente non c'erano.
  const s = statoAutomazioni([], ADESSO);
  assert.equal(s.length, JOBS.length);
  assert.ok(s.every((x) => x.inRitardo && x.oreFa === null && x.ultimo === null));
  assert.equal(quanteDaGuardare(s), JOBS.length);
});

test("un giro fallito si segnala anche se è recente", () => {
  // Il 20 settembre: girato in orario, morto a metà. Puntuale e inutile.
  const r = statoAutomazioni([giro("daily-digest", 2, false)], ADESSO).find((x) => x.nome === "daily-digest")!;
  assert.equal(r.inRitardo, false);
  assert.equal(r.fallito, true);
  assert.equal(quanteDaGuardare(statoAutomazioni([giro("daily-digest", 2, false)], ADESSO)), JOBS.length);
});

test("fra due giri dello stesso lavoro vince il più recente", () => {
  const r = statoAutomazioni([giro("dunning", 50), giro("dunning", 4)], ADESSO).find((x) => x.nome === "dunning")!;
  assert.equal(r.inRitardo, false);
  assert.equal(Math.round(r.oreFa!), 4);
});

test("un giro di un lavoro che non è in elenco non fa sparire gli altri", () => {
  const s = statoAutomazioni([giro("lavoro-che-non-esiste", 1)], ADESSO);
  assert.equal(s.length, JOBS.length);
  assert.ok(s.every((x) => x.inRitardo));
});

test("date malformate non fanno passare un lavoro fermo per sano", () => {
  const s = statoAutomazioni([{ job: "recurring", started_at: "non-una-data", ok: true, riassunto: null, errore: null }], ADESSO);
  const r = s.find((x) => x.nome === "recurring")!;
  assert.equal(r.oreFa, null);
  assert.equal(r.inRitardo, true);
});

test("il giorno in cui si accende il registro, nessun lavoro è «fermo»", () => {
  // Un allarme che parte quando va tutto bene insegna a ignorarlo.
  const registroDa = new Date(ADESSO - 2 * ORA).toISOString();
  const s = statoAutomazioni([], ADESSO, registroDa);
  assert.ok(s.every((x) => x.inAttesa && !x.inRitardo));
  assert.equal(quanteDaGuardare(s), 0);
});

test("passata la soglia, il silenzio torna a essere un sintomo", () => {
  const registroDa = new Date(ADESSO - 40 * ORA).toISOString();
  const s = statoAutomazioni([], ADESSO, registroDa);
  assert.ok(s.every((x) => !x.inAttesa && x.inRitardo));
});

test("un registro giovane non copre un lavoro che ha girato male", () => {
  const registroDa = new Date(ADESSO - 2 * ORA).toISOString();
  const s = statoAutomazioni([giro("dunning", 1, false)], ADESSO, registroDa);
  const d = s.find((x) => x.nome === "dunning")!;
  assert.equal(d.fallito, true);
  assert.equal(quanteDaGuardare(s), 1);
});
