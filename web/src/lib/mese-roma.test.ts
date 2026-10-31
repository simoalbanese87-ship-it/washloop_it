import { test } from "node:test";
import assert from "node:assert/strict";
import { meseRoma, confiniMeseRoma } from "./mese-roma.ts";

test("il mese è quello italiano, non quello UTC", () => {
  // Le 00:30 del 1° novembre a Roma sono ancora il 31 ottobre in UTC.
  assert.equal(meseRoma("2026-10-31T23:30:00.000Z"), "2026-11");
  assert.equal(meseRoma("2026-10-31T22:30:00.000Z"), "2026-10");
});

test("il mese comincia a mezzanotte italiana", () => {
  // Ottobre: ora legale, Roma è UTC+2 → il mese parte alle 22:00 del 30/09.
  assert.equal(confiniMeseRoma("2026-10").dalIso, "2026-09-30T22:00:00.000Z");
  // Novembre: ora solare, UTC+1 → parte alle 23:00 del 31/10.
  assert.equal(confiniMeseRoma("2026-11").dalIso, "2026-10-31T23:00:00.000Z");
});

test("la fine di un mese è l'inizio del successivo", () => {
  assert.equal(confiniMeseRoma("2026-10").alIso, confiniMeseRoma("2026-11").dalIso);
  assert.equal(confiniMeseRoma("2026-11").alIso, confiniMeseRoma("2026-12").dalIso);
});

test("dicembre passa all'anno dopo e non al mese 13", () => {
  assert.equal(confiniMeseRoma("2026-12").alIso, confiniMeseRoma("2027-01").dalIso);
  assert.equal(confiniMeseRoma("2026-12").alIso.slice(0, 4), "2026");
});

test("un incasso sul bordo cade nel mese che lo contiene", () => {
  const ott = confiniMeseRoma("2026-10");
  // Il cambio dell'ora legale cade il 25 ottobre: il mese resta intero.
  assert.ok(ott.dalIso < "2026-10-01T00:00:00.000Z");
  assert.ok(ott.alIso > "2026-10-31T22:00:00.000Z");
  assert.equal(meseRoma(ott.dalIso), "2026-10");
  assert.equal(meseRoma(ott.alIso), "2026-11");
});
