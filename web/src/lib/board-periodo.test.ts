import { test } from "node:test";
import assert from "node:assert/strict";
import { arretrato, passaPeriodo } from "./board-periodo.ts";

const OGGI = "2026-08-27";
const FINE_SETTIMANA = "2026-09-02";

test("il caso vero: un ritiro del 24 mai avvenuto si vede ancora il 27", () => {
  // Ordine di domenica d'agosto: ritiro previsto il 24 agosto, stato
  // pickup_scheduled, mai ritirato. La home lo contava fra quelli in ritardo,
  // il board con il filtro "oggi" mostrava zero.
  const o = { status: "pickup_scheduled", giorno: "2026-08-24" };
  assert.equal(arretrato(o, OGGI), true);
  assert.equal(passaPeriodo(o, "oggi", OGGI, FINE_SETTIMANA), true);
  assert.equal(passaPeriodo(o, "settimana", OGGI, FINE_SETTIMANA), true);
  assert.equal(passaPeriodo(o, "tutti", OGGI, FINE_SETTIMANA), true);
});

test("un ordine chiuso in un giorno passato non è un arretrato", () => {
  for (const status of ["delivered", "completed", "cancelled"]) {
    const o = { status, giorno: "2026-08-24" };
    assert.equal(arretrato(o, OGGI), false, status);
    assert.equal(passaPeriodo(o, "oggi", OGGI, FINE_SETTIMANA), false, status);
  }
});

test("i passaggi di oggi si vedono nella vista oggi", () => {
  const o = { status: "pickup_scheduled", giorno: OGGI };
  assert.equal(passaPeriodo(o, "oggi", OGGI, FINE_SETTIMANA), true);
});

test("i passaggi futuri non invadono la vista di oggi, ma stanno nella settimana", () => {
  const o = { status: "pickup_scheduled", giorno: "2026-08-30" };
  assert.equal(passaPeriodo(o, "oggi", OGGI, FINE_SETTIMANA), false);
  assert.equal(passaPeriodo(o, "settimana", OGGI, FINE_SETTIMANA), true);
});

test("oltre la settimana resta fuori, ma non se è arretrato", () => {
  const lontano = { status: "pickup_scheduled", giorno: "2026-09-20" };
  assert.equal(passaPeriodo(lontano, "settimana", OGGI, FINE_SETTIMANA), false);
  assert.equal(passaPeriodo(lontano, "tutti", OGGI, FINE_SETTIMANA), true);
});

test("prima dell'idratazione non si filtra niente: il board non deve nascere vuoto", () => {
  const o = { status: "pickup_scheduled", giorno: "2026-09-20" };
  assert.equal(passaPeriodo(o, "oggi", "", ""), true);
});

test("con la vista 'tutti' passa qualunque cosa, anche i chiusi", () => {
  const o = { status: "delivered", giorno: "2026-01-01" };
  assert.equal(passaPeriodo(o, "tutti", OGGI, FINE_SETTIMANA), true);
});
