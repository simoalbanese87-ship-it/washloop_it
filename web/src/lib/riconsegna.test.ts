import { test } from "node:test";
import assert from "node:assert/strict";
import { daRisistemare, fasceProponibili, prontoDa, riconsegnaDopoSpostamento } from "./riconsegna.ts";

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

test("non si può prenotare la riconsegna a settimane di distanza", () => {
  // Caso vero: una cliente ha scelto ritiro il 23 settembre e riconsegna il 30
  // ottobre. Cinque settimane con il suo bucato fermo da noi.
  const fasce = [
    f("tradue", "2026-08-27T12:00:00Z"),
    f("aunasettimana", "2026-09-02T12:00:00Z"),
    f("troppolontano", "2026-10-05T12:00:00Z"),
  ];
  const ids = fasceProponibili(fasce, RITIRO, 48).map((x) => x.id);
  assert.ok(ids.includes("tradue"));
  assert.ok(!ids.includes("troppolontano"), "una fascia a settimane di distanza non va proposta");
});

test("il bordo della finestra è incluso, un minuto dopo no", () => {
  // Ritiro lunedì 24/08 08:00 + 48h → pronto mercoledì 26/08 08:00.
  // Finestra di 7 giorni → si chiude il 02/09 alle 08:00, non a mezzogiorno.
  const dentro = [f("albordo", "2026-09-02T08:00:00Z")];
  const fuori = [f("unminutodopo", "2026-09-02T08:01:00Z")];
  assert.equal(fasceProponibili(dentro, RITIRO, 48).length, 1);
  assert.equal(fasceProponibili(fuori, RITIRO, 48).length, 0);
});

// --- La riconsegna quando il ritiro si sposta -------------------------------

const attuale = (iso: string, archiviata = false) => ({ starts_at: iso, archiviata });

test("se la riconsegna fissata va ancora bene non si tocca", () => {
  const fasce = [f("altra", "2026-08-27T10:00:00Z")];
  const esito = riconsegnaDopoSpostamento(fasce, attuale("2026-08-26T10:00:00Z"), RITIRO, 48);
  assert.deepEqual(esito, { azione: "tiene" });
});

test("una riconsegna finita prima della fine della lavorazione si sposta alla prima buona", () => {
  // Ritiro spostato in avanti: la riconsegna di martedì ora cadrebbe mentre il
  // bucato è ancora in lavatrice.
  const fasce = [
    f("troppo-presto", "2026-08-26T10:00:00Z"),
    f("prima-buona", "2026-08-28T10:00:00Z"),
    f("dopo", "2026-08-29T10:00:00Z"),
  ];
  const esito = riconsegnaDopoSpostamento(fasce, attuale("2026-08-26T10:00:00Z"), "2026-08-26T08:00:00Z", 48);
  assert.equal(esito.azione, "sposta");
  assert.equal(esito.azione === "sposta" ? esito.fascia.id : null, "prima-buona");
});

test("senza nessuna fascia valida la riconsegna si libera invece di restare impossibile", () => {
  const esito = riconsegnaDopoSpostamento([], attuale("2026-08-26T10:00:00Z"), "2026-08-26T08:00:00Z", 48);
  assert.deepEqual(esito, { azione: "libera" });
});

test("una riconsegna su fascia archiviata si sposta anche se l'ora andrebbe bene", () => {
  // È il caso di Saverio: giovedì 10 alle 10:30 è un orario sensato, ma quella
  // fascia è stata tolta dal calendario e quel giorno non passa nessuno.
  const fasce = [f("attiva", "2026-08-27T09:00:00Z")];
  const esito = riconsegnaDopoSpostamento(fasce, attuale("2026-08-26T10:00:00Z", true), RITIRO, 48);
  assert.equal(esito.azione, "sposta");
  assert.equal(esito.azione === "sposta" ? esito.fascia.id : null, "attiva");
});

test("un ordine senza riconsegna fissata non è un problema da risolvere qui", () => {
  assert.deepEqual(riconsegnaDopoSpostamento([], null, RITIRO, 48), { azione: "tiene" });
});

// --- Ordini rimasti su fasce tolte dal calendario ---------------------------

test("un ordine aperto su una fascia archiviata è da risistemare", () => {
  assert.equal(daRisistemare({ aperto: true, ritiroArchiviato: false, riconsegnaArchiviata: true }), true);
  assert.equal(daRisistemare({ aperto: true, ritiroArchiviato: true, riconsegnaArchiviata: false }), true);
});

test("un ordine chiuso su una fascia archiviata è storia, non lavoro arretrato", () => {
  assert.equal(daRisistemare({ aperto: false, ritiroArchiviato: true, riconsegnaArchiviata: true }), false);
});

test("un ordine aperto con entrambe le fasce vive non compare", () => {
  assert.equal(daRisistemare({ aperto: true, ritiroArchiviato: false, riconsegnaArchiviata: false }), false);
});
