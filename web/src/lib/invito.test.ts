import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizzaCodice, codiceValido, valoreSettimana, premioSpettante, linkInvito } from "./invito.ts";

test("il codice si riconosce comunque sia scritto", () => {
  assert.equal(normalizzaCodice("WL-1234"), "WL-1234");
  assert.equal(normalizzaCodice("wl-1234"), "WL-1234");
  assert.equal(normalizzaCodice("  WL-1234  "), "WL-1234");
});

test("si riconosce anche dentro il link che la gente condivide", () => {
  // Chi invita manda il link, non il codice: se finisce incollato in un campo
  // deve funzionare lo stesso. Stessa tolleranza dello scanner del rider.
  assert.equal(normalizzaCodice("https://washloop.it/invita/WL-1234"), "WL-1234");
  assert.equal(normalizzaCodice("washloop.it/invita/wl-9645?x=1"), "WL-9645");
});

test("quello che non è un codice non diventa un codice", () => {
  for (const v of ["WL-12", "1234", "WL1234", "", null, undefined, "ciao"]) {
    assert.equal(normalizzaCodice(v), null, String(v));
    assert.equal(codiceValido(v), false, String(v));
  }
});

test("una settimana è un quarto del canone", () => {
  assert.equal(valoreSettimana(16000), 4000); // Small
  assert.equal(valoreSettimana(28000), 7000); // Medium
  assert.equal(valoreSettimana(39000), 9750); // Large
});

test("senza canone non c'è settimana da calcolare", () => {
  for (const v of [0, null, undefined, -100, NaN]) {
    assert.equal(valoreSettimana(v as number), 0, String(v));
  }
});

test("non ci si può invitare da soli", () => {
  const e = premioSpettante({ invitanteId: "a", invitatoId: "a", canoneInvitanteCents: 16000 });
  assert.equal(e.spetta, false);
});

test("il premio normale matura e vale una settimana di chi ha invitato", () => {
  const e = premioSpettante({ invitanteId: "a", invitatoId: "b", canoneInvitanteCents: 16000 });
  assert.equal(e.spetta, true);
  if (!e.spetta) return;
  assert.equal(e.stato, "maturato");
  assert.equal(e.valoreCents, 4000);
  assert.equal(e.motivo, null);
});

test("chi invita senza canone genera un premio sospeso, non un premio perso", () => {
  // Ha disdetto, è a consumo, o ha comprato un pacchetto a termine: il premio
  // esiste e lo si decide a mano, invece di calcolarlo su un numero inventato.
  const e = premioSpettante({ invitanteId: "a", invitatoId: "b", canoneInvitanteCents: 0 });
  assert.equal(e.spetta, true);
  if (!e.spetta) return;
  assert.equal(e.stato, "sospeso");
  assert.equal(e.valoreCents, 0);
  assert.ok(e.motivo && e.motivo.length > 10);
});

test("il link si compone in un modo solo", () => {
  assert.equal(linkInvito("https://washloop.it", "WL-1234"), "https://washloop.it/invita/WL-1234");
  assert.equal(linkInvito("https://washloop.it/", "wl-1234"), "https://washloop.it/invita/WL-1234");
});
