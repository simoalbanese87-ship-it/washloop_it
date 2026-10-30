import { test } from "node:test";
import assert from "node:assert/strict";
import { puoPrenotare, abbonamentoVivo, perchePuoNonPrenotare } from "./puo-prenotare.ts";

test("un abbonato attivo prenota", () => {
  assert.equal(puoPrenotare({ statoAbbonamento: "active" }), true);
  assert.equal(puoPrenotare({ statoAbbonamento: "trialing" }), true);
});

test("il cliente a consumo prenota anche senza abbonamento", () => {
  // È il punto: «deve poter prenotare come gli altri, quando vuole».
  assert.equal(puoPrenotare({ statoAbbonamento: null, aConsumo: true }), true);
  assert.equal(perchePuoNonPrenotare({ aConsumo: true }), null);
});

test("chi non ha niente non prenota", () => {
  assert.equal(puoPrenotare({}), false);
  assert.equal(puoPrenotare({ statoAbbonamento: null, aConsumo: false }), false);
});

test("un ex cliente non diventa a consumo per il fatto di essere ex", () => {
  // La differenza fra un cliente a consumo e un ex cliente non sta nei dati:
  // sta in un accordo, e l'accordo è il flag.
  assert.equal(puoPrenotare({ statoAbbonamento: "canceled" }), false);
  assert.equal(puoPrenotare({ statoAbbonamento: "incomplete" }), false);
});

test("chi ha una fattura aperta legge perché, non «serve un abbonamento»", () => {
  assert.equal(perchePuoNonPrenotare({ statoAbbonamento: "past_due" }), "C'è una fattura rimasta aperta: appena è saldata torni a prenotare.");
  assert.equal(perchePuoNonPrenotare({ statoAbbonamento: "unpaid" })?.startsWith("C'è una fattura"), true);
});

test("a consumo vince anche su un abbonamento scaduto", () => {
  // Chi passa da abbonato a consumo non deve restare bloccato dalla riga vecchia.
  assert.equal(puoPrenotare({ statoAbbonamento: "canceled", aConsumo: true }), true);
});

test("abbonamentoVivo non si fa ingannare da uno stato vuoto", () => {
  assert.equal(abbonamentoVivo(null), false);
  assert.equal(abbonamentoVivo(""), false);
  assert.equal(abbonamentoVivo("active"), true);
});

test("un abbonamento a cadenza libera non ha nessun numero da finire", () => {
  // I cinque abbonati di oggi non hanno un numero di ritiri: per loro non deve
  // cambiare niente, ed è la cosa che questa modifica può rompere.
  assert.equal(puoPrenotare({ statoAbbonamento: "active", abbonamentoARitiri: false }), true);
  assert.equal(puoPrenotare({ statoAbbonamento: "active" }), true);
});

test("un ritiro comprato fa prenotare anche senza abbonamento", () => {
  assert.equal(puoPrenotare({ ritiri: 1 }), true);
  assert.equal(puoPrenotare({ statoAbbonamento: null, aConsumo: false, ritiri: 2 }), true);
});

test("il ritiro comprato resta dovuto anche a chi ha disdetto", () => {
  // L'ha pagato: che nel frattempo l'abbonamento sia finito non glielo toglie.
  assert.equal(puoPrenotare({ statoAbbonamento: "canceled", ritiri: 1 }), true);
});

test("l'abbonamento a ritiri prenota finché ne ha, e non per lo stato", () => {
  assert.equal(puoPrenotare({ statoAbbonamento: "active", abbonamentoARitiri: true, ritiri: 1 }), true);
  assert.equal(puoPrenotare({ statoAbbonamento: "active", abbonamentoARitiri: true, ritiri: 0 }), false);
  assert.equal(
    perchePuoNonPrenotare({ statoAbbonamento: "active", abbonamentoARitiri: true, ritiri: 0 }),
    "Hai usato tutti i ritiri che avevi: al prossimo rinnovo te ne arrivano altri.",
  );
});

test("chi ha finito i ritiri comprati non legge «serve un abbonamento attivo»", () => {
  assert.equal(puoPrenotare({ ritiri: 0, ritiriAccreditati: 2 }), false);
  assert.equal(
    perchePuoNonPrenotare({ ritiri: 0, ritiriAccreditati: 2 }),
    "Hai usato tutti i ritiri che hai comprato: comprane un altro o passa all'abbonamento.",
  );
  // Chi non ne ha mai comprati legge ancora la frase di prima.
  assert.equal(perchePuoNonPrenotare({ ritiri: 0, ritiriAccreditati: 0 }), "Serve un abbonamento attivo.");
});

test("i ritiri non scadono: nessuna data entra in questo cancello", () => {
  // Il vecchio tetto faceva scadere col ciclo quello che avanzava. Qui il
  // tempo non toglie niente: un ritiro comprato a ottobre vale a dicembre.
  assert.equal(puoPrenotare({ statoAbbonamento: "canceled", ritiri: 3 }), true);
});
