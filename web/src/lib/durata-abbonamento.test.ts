import { test } from "node:test";
import assert from "node:assert/strict";
import { ricorrenza, cadenzaTesto, settimaneValide, fineDelCiclo, DURATE } from "./durata-abbonamento.ts";

test("senza durata l'abbonamento resta mensile", () => {
  assert.deepEqual(ricorrenza(null), { interval: "month", interval_count: 1 });
  assert.equal(cadenzaTesto(null), "/mese");
});

test("una durata a termine diventa un unico ciclo settimanale", () => {
  // Il punto di tutto: `interval_count` è il numero di settimane, quindi
  // dentro il periodo non c'è nessun secondo addebito.
  assert.deepEqual(ricorrenza(1), { interval: "week", interval_count: 1 });
  assert.deepEqual(ricorrenza(4), { interval: "week", interval_count: 4 });
});

test("tutte le durate del menu sono valide", () => {
  for (const n of DURATE) assert.deepEqual(ricorrenza(n), { interval: "week", interval_count: n });
});

test("una durata assurda non diventa un prezzo strano: si torna al mensile", () => {
  for (const v of [0, -1, 1.5, 53, NaN, "", "due", null, undefined]) {
    assert.equal(settimaneValide(v), null, `${String(v)} doveva essere rifiutato`);
    assert.deepEqual(ricorrenza(v as number | null), { interval: "month", interval_count: 1 });
  }
});

test("la durata arriva dal form come stringa", () => {
  assert.equal(settimaneValide("2"), 2);
  assert.equal(settimaneValide(" 3 "), 3);
});

test("singolare e plurale, perché la frase la legge il cliente", () => {
  assert.equal(cadenzaTesto(1), " per 1 settimana");
  assert.equal(cadenzaTesto(2), " per 2 settimane");
});

test("la fine del ciclo è N settimane dopo l'inizio", () => {
  assert.equal(fineDelCiclo("2026-10-01T09:00:00.000Z", 1), "2026-10-08T09:00:00.000Z");
  assert.equal(fineDelCiclo("2026-10-01T09:00:00.000Z", 4), "2026-10-29T09:00:00.000Z");
});
