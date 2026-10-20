import { test } from "node:test";
import assert from "node:assert/strict";
import { categoriaDi, eAggiustamentoDiCanone, eRicavoDiCompetenza } from "./categoria-addebito.ts";

test("un addebito di servizio è un ricavo", () => {
  assert.equal(eRicavoDiCompetenza({ kind: "charge", status: "settled", categoria: "servizio" }), true);
  // Anche quello a sacco: è un incasso come gli altri, e finora la pagina
  // Competenza lo perdeva perché filtrava sul tipo.
  assert.equal(eRicavoDiCompetenza({ kind: "sacco", status: "settled", categoria: "servizio" }), true);
});

test("il conguaglio di un cambio piano non è un ricavo in più", () => {
  // I 72,00 € di Federica: il canone del mese lo conta già la quota settimanale.
  const conguaglio = { kind: "charge", status: "settled", categoria: "canone" };
  assert.equal(eRicavoDiCompetenza(conguaglio), false);
  assert.equal(eAggiustamentoDiCanone(conguaglio), true);
});

test("il rimborso di un canone è un aggiustamento, non uno storno di capo", () => {
  const rimborso = { kind: "refund", status: "settled", categoria: "canone" };
  assert.equal(eRicavoDiCompetenza(rimborso), false);
  assert.equal(eAggiustamentoDiCanone(rimborso), true);
});

test("le gemelle dei capi restano fuori da tutto", () => {
  const storno = { kind: "refund", status: "settled", categoria: "capo" };
  assert.equal(eRicavoDiCompetenza(storno), false);
  assert.equal(eAggiustamentoDiCanone(storno), false, "non è un canone: è un capo, già fuori dal conto");
});

test("un movimento annullato non è niente", () => {
  assert.equal(eRicavoDiCompetenza({ kind: "charge", status: "void", categoria: "servizio" }), false);
  assert.equal(eAggiustamentoDiCanone({ kind: "charge", status: "void", categoria: "canone" }), false);
});

test("le righe scritte prima della colonna valgono come servizio", () => {
  assert.equal(categoriaDi({ kind: "charge", status: "settled" }), "servizio");
  assert.equal(categoriaDi({ kind: "charge", status: "settled", categoria: null }), "servizio");
  assert.equal(eRicavoDiCompetenza({ kind: "charge", status: "settled" }), true);
  // Un valore che non conosciamo non manda via un incasso vero.
  assert.equal(categoriaDi({ kind: "charge", status: "settled", categoria: "boh" }), "servizio");
});
