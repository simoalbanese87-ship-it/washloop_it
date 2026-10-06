import test from "node:test";
import assert from "node:assert/strict";
import { primoGiornoDelGiro } from "./giro-del-giorno.ts";

test("il giro è il primo giorno con un ritiro concordato", () => {
  const voci = [
    { giorno: "2026-10-09", tipo: "riconsegna" as const, confermato: true },
    { giorno: "2026-10-13", tipo: "ritiro" as const, confermato: true },
    { giorno: "2026-10-20", tipo: "ritiro" as const, confermato: true },
  ];
  assert.equal(primoGiornoDelGiro(voci, "2026-10-06"), "2026-10-13");
});

test("un ritiro soltanto previsto non fa giro", () => {
  const voci = [{ giorno: "2026-10-13", tipo: "ritiro" as const, confermato: false }];
  assert.equal(primoGiornoDelGiro(voci, "2026-10-06"), null);
});

test("i giorni passati non si organizzano più", () => {
  const voci = [
    { giorno: "2026-10-02", tipo: "ritiro" as const, confermato: true },
    { giorno: "2026-10-13", tipo: "ritiro" as const, confermato: true },
  ];
  assert.equal(primoGiornoDelGiro(voci, "2026-10-06"), "2026-10-13");
});

test("oggi conta: un ritiro di stamattina è ancora il giro di oggi", () => {
  const voci = [{ giorno: "2026-10-06", tipo: "ritiro" as const, confermato: true }];
  assert.equal(primoGiornoDelGiro(voci, "2026-10-06"), "2026-10-06");
});

test("solo riconsegne: niente mappa", () => {
  const voci = [{ giorno: "2026-10-09", tipo: "riconsegna" as const, confermato: true }];
  assert.equal(primoGiornoDelGiro(voci, "2026-10-06"), null);
});
