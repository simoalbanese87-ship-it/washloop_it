import { test } from "node:test";
import assert from "node:assert/strict";
import { nomeBreveLavanderia } from "./nome-lavanderia.ts";
import { tipoServizioDellaSede, TIPO_SERVIZIO_LABEL } from "./tipo-servizio.ts";

test("la ragione sociale delle nostre due sedi si accorcia come le chiamiamo", () => {
  assert.equal(
    nomeBreveLavanderia("Centro Pulitura Bergamo di Narisi Giuseppe & C. Snc"),
    "Centro Pulitura Bergamo",
  );
  // Un nome che è già corto resta intero: non c'è niente da togliere.
  assert.equal(nomeBreveLavanderia("Susanna Ferrari"), "Susanna Ferrari");
});

test("le forme societarie si tagliano comunque siano scritte", () => {
  assert.equal(nomeBreveLavanderia("Lavanderia Aurora S.r.l."), "Lavanderia Aurora");
  assert.equal(nomeBreveLavanderia("Lavanderia Aurora srl"), "Lavanderia Aurora");
  assert.equal(nomeBreveLavanderia("Stireria Milano S.A.S."), "Stireria Milano");
  assert.equal(nomeBreveLavanderia("Pulitura Nord & C."), "Pulitura Nord");
});

test("non si taglia dentro una parola", () => {
  // «Sassi» comincia per «s» ma non è una forma societaria, e «Dino» contiene
  // «di» senza essere un titolare.
  assert.equal(nomeBreveLavanderia("Lavanderia Sassi"), "Lavanderia Sassi");
  assert.equal(nomeBreveLavanderia("Lavanderia Dino"), "Lavanderia Dino");
});

test("quando non c'è niente da tagliare il nome resta com'è", () => {
  assert.equal(nomeBreveLavanderia("Bianco Lino"), "Bianco Lino");
  assert.equal(nomeBreveLavanderia(""), "");
  assert.equal(nomeBreveLavanderia(null), "");
  assert.equal(nomeBreveLavanderia(undefined), "");
});

test("un taglio che lascerebbe un moncone restituisce il nome intero", () => {
  // Qui il taglio cadrebbe subito: meglio il nome lungo di «Da».
  assert.equal(nomeBreveLavanderia("Da di Mario Rossi"), "Da di Mario Rossi");
});

test("la sede dice il servizio con le parole dell'anagrafica", () => {
  assert.equal(tipoServizioDellaSede("stiro"), "solo_stiro");
  assert.equal(tipoServizioDellaSede("lavanderia"), "lava_stira");
  assert.equal(tipoServizioDellaSede(null), null);
  assert.equal(tipoServizioDellaSede(undefined), null);
  // L'etichetta è quella che l'ops vede nel pannello, non una nuova.
  assert.equal(TIPO_SERVIZIO_LABEL[tipoServizioDellaSede("stiro")!], "Solo stiro");
  assert.equal(TIPO_SERVIZIO_LABEL[tipoServizioDellaSede("lavanderia")!], "Lavanderia");
});
