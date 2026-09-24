import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizzaNota, anteprimaNota, destinazioneNota, NOTA_MAX } from "./nota-persona.ts";

test("una nota vuota o di soli spazi è null, non stringa vuota", () => {
  // È la condizione che decide fra salvare e cancellare: "" salverebbe una riga
  // vuota che poi qualcuno deve capire.
  assert.equal(normalizzaNota(""), null);
  assert.equal(normalizzaNota("   \n  "), null);
  assert.equal(normalizzaNota(null), null);
  assert.equal(normalizzaNota(undefined), null);
});

test("il testo viene ripulito ai bordi ma non dentro", () => {
  assert.equal(normalizzaNota("  richiamare  lunedì  "), "richiamare  lunedì");
});

test("oltre il massimo si taglia invece di rifiutare", () => {
  const lunga = "a".repeat(NOTA_MAX + 50);
  assert.equal(normalizzaNota(lunga)?.length, NOTA_MAX);
});

test("l'anteprima taglia sulla parola e mette i puntini solo se ha tagliato", () => {
  assert.equal(anteprimaNota("Richiamare lunedì"), "Richiamare lunedì");
  const t = anteprimaNota("Richiamare lunedì mattina per confermare la fascia del ritiro", 30);
  assert.ok(t.endsWith("…"));
  assert.ok(!t.includes("confermare"));
  assert.ok(t.length <= 31);
});

test("l'anteprima appiattisce gli a capo: in una cella di tabella sono spazi", () => {
  assert.equal(anteprimaNota("prima riga\nseconda"), "prima riga seconda");
});

test("la nota va a un profilo oppure a un lead, mai a entrambi", () => {
  assert.equal(destinazioneNota({ profileId: "p1" }), "cliente");
  assert.equal(destinazioneNota({ leadId: "l1" }), "lead");
  assert.equal(destinazioneNota({ profileId: "p1", leadId: "l1" }), "ambigua");
  assert.equal(destinazioneNota({}), "mancante");
  // Un campo hidden vuoto arriva come "", non come assente: senza il trim
  // sarebbe passato per "cliente".
  assert.equal(destinazioneNota({ profileId: "", leadId: "l1" }), "lead");
});
