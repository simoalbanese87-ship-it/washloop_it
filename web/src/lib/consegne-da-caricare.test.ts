import { test } from "node:test";
import assert from "node:assert/strict";
import { daCaricareOggi, eAzionabile, type RigaGiro } from "./consegne-da-caricare.ts";

// Fine giornata di venerdì 2 ottobre 2026, ora di Roma.
const FINE_OGGI = Date.parse("2026-10-02T21:59:00.000Z");
const r = (p: Partial<RigaGiro> = {}): RigaGiro => ({
  status: "washing",
  riconsegnaIso: "2026-10-02T07:00:00.000Z",
  ...p,
});

test("una consegna di oggi ferma in lavaggio è da caricare", () => {
  // Il caso vero: quattro sacchi fermi su «in lavaggio» dal 29 settembre, con
  // la riconsegna prevista stamattina.
  assert.equal(daCaricareOggi([r()], FINE_OGGI).length, 1);
});

test("tutti gli stati dentro la lavanderia valgono", () => {
  for (const status of ["picked_up", "at_laundry", "washing", "ready"] as const) {
    assert.equal(daCaricareOggi([r({ status })], FINE_OGGI).length, 1, status);
  }
});

test("quello che è già nel giro non si carica due volte", () => {
  for (const status of ["delivery_scheduled", "out_for_delivery"] as const) {
    assert.equal(daCaricareOggi([r({ status })], FINE_OGGI).length, 0, status);
    assert.equal(eAzionabile(status), true, status);
  }
});

test("un ritiro non è una consegna da caricare", () => {
  assert.equal(daCaricareOggi([r({ status: "pickup_scheduled" })], FINE_OGGI).length, 0);
});

test("la consegna di domani non si carica oggi", () => {
  assert.equal(daCaricareOggi([r({ riconsegnaIso: "2026-10-09T07:00:00.000Z" })], FINE_OGGI).length, 0);
});

test("una consegna rimasta indietro resta da caricare", () => {
  // Arretrata, non nascosta: va recuperata.
  assert.equal(daCaricareOggi([r({ riconsegnaIso: "2026-10-01T07:00:00.000Z" })], FINE_OGGI).length, 1);
});

test("senza fascia non si carica niente", () => {
  // Un sacco in furgone senza un'ora a cui portarlo è peggio di un sacco fermo.
  assert.equal(daCaricareOggi([r({ riconsegnaIso: null })], FINE_OGGI).length, 0);
  assert.equal(daCaricareOggi([r({ riconsegnaIso: "non una data" })], FINE_OGGI).length, 0);
});

test("gli stati chiusi non tornano a galla", () => {
  for (const status of ["delivered", "completed", "cancelled"] as const) {
    assert.equal(daCaricareOggi([r({ status })], FINE_OGGI).length, 0, status);
  }
});
