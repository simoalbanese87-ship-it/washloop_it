import { test } from "node:test";
import assert from "node:assert/strict";
import { fasceProponibili, prontoDa } from "./riconsegna.ts";

const RITIRO = "2026-08-24T08:00:00Z"; // lunedì mattina

const f = (id: string, iso: string) => ({ id, starts_at: iso });

test("il bucato è pronto dopo le ore di lavorazione del piano, non dopo 72", () => {
  assert.equal(prontoDa(RITIRO, 48).toISOString(), "2026-08-26T08:00:00.000Z");
  assert.equal(prontoDa(RITIRO, 24).toISOString(), "2026-08-25T08:00:00.000Z");
});

test("le fasce prima della fine della lavorazione non si propongono", () => {
  const fasce = [
    f("presto", "2026-08-25T10:00:00Z"), // il giorno dopo: troppo presto con 48h
    f("giusto", "2026-08-26T10:00:00Z"),
    f("dopo", "2026-08-27T10:00:00Z"),
  ];
  assert.deepEqual(fasceProponibili(fasce, RITIRO, 48).map((x) => x.id), ["giusto", "dopo"]);
});

test("con il piano veloce si apre un giorno prima", () => {
  const fasce = [f("presto", "2026-08-25T10:00:00Z"), f("dopo", "2026-08-26T10:00:00Z")];
  assert.deepEqual(fasceProponibili(fasce, RITIRO, 24).map((x) => x.id), ["presto", "dopo"]);
});

test("la fascia che apre esattamente quando finisce la lavorazione è valida", () => {
  const fasce = [f("albordo", "2026-08-26T08:00:00Z")];
  assert.deepEqual(fasceProponibili(fasce, RITIRO, 48).map((x) => x.id), ["albordo"]);
});

test("un minuto prima no", () => {
  const fasce = [f("unminutoprima", "2026-08-26T07:59:00Z")];
  assert.deepEqual(fasceProponibili(fasce, RITIRO, 48), []);
});

test("l'elenco torna in ordine di tempo, non nell'ordine in cui è arrivato", () => {
  const fasce = [
    f("giovedi", "2026-08-27T10:00:00Z"),
    f("mercoledi", "2026-08-26T10:00:00Z"),
    f("venerdi", "2026-08-28T10:00:00Z"),
  ];
  assert.deepEqual(fasceProponibili(fasce, RITIRO, 48).map((x) => x.id), ["mercoledi", "giovedi", "venerdi"]);
});

test("nessuna fascia dopo la lavorazione: elenco vuoto, non un errore", () => {
  // Succede davvero: in produzione le fasce di consegna future sono poche.
  // Il flusso deve poter andare avanti lo stesso, con la riconsegna da fissare.
  assert.deepEqual(fasceProponibili([f("troppopresto", "2026-08-24T20:00:00Z")], RITIRO, 48), []);
  assert.deepEqual(fasceProponibili([], RITIRO, 48), []);
});
