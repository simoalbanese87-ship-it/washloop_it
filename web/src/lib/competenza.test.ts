import { test } from "node:test";
import assert from "node:assert/strict";
import { lunediDi, quotaPerRitiro, costoPrevistoCents, settimaneDiCompetenza, margineCents } from "./competenza.ts";

test("la settimana comincia di lunedì, in ora di Roma", () => {
  assert.equal(lunediDi("2026-09-14T06:00:00Z"), "2026-09-14"); // lunedì
  assert.equal(lunediDi("2026-09-17T06:00:00Z"), "2026-09-14"); // giovedì
  assert.equal(lunediDi("2026-09-20T06:00:00Z"), "2026-09-14"); // domenica
  assert.equal(lunediDi("2026-09-21T06:00:00Z"), "2026-09-21"); // lunedì dopo
});

test("mezzanotte a Roma è ancora il giorno prima in UTC", () => {
  // 21 settembre 00:30 a Roma = 20 settembre 22:30 UTC. Leggendo in UTC la
  // settimana sarebbe quella di prima: è l'errore che fa slittare un ritiro
  // notturno nella settimana sbagliata.
  assert.equal(lunediDi("2026-09-20T22:30:00Z"), "2026-09-21");
});

test("il canone si divide per i ritiri fatti davvero, non per quattro", () => {
  assert.equal(quotaPerRitiro(16000, 4), 4000);
  // Due soli ritiri in un mese: quei due valgono tutto il canone.
  assert.equal(quotaPerRitiro(16000, 2), 8000);
});

test("un mese senza ritiri non matura canone e non divide per zero", () => {
  assert.equal(quotaPerRitiro(16000, 0), 0);
});

test("il costo previsto si calcola solo su chi ha un piano", () => {
  const r = costoPrevistoCents(
    [
      { clienteId: "a", canoneCents: 16000, sacchiPrevisti: 1 },
      { clienteId: "b", canoneCents: 28000, sacchiPrevisti: 2 },
      { clienteId: "c", canoneCents: 6000, sacchiPrevisti: null }, // su misura
    ],
    1230,
  );
  assert.equal(r.cents, 1230 * 3);
  assert.equal(r.conPiano, 2);
  // Chi resta fuori va detto: un previsto che ignora un cliente senza dirlo
  // fa sembrare che stiamo spendendo più del dovuto.
  assert.equal(r.senzaPiano, 1);
});

test("ogni ritiro porta la sua quota di canone nella sua settimana", () => {
  const ritiri = [
    { clienteId: "a", settimana: "2026-09-07", mese: "2026-09", sacchi: 1 },
    { clienteId: "a", settimana: "2026-09-14", mese: "2026-09", sacchi: 2 },
  ];
  const s = settimaneDiCompetenza(ritiri, [{ clienteId: "a", canoneCents: 16000, sacchiPrevisti: 1 }], new Map(), new Map());
  assert.equal(s.length, 2);
  // Due ritiri nel mese: 8000 ciascuno.
  assert.equal(s[0].ricavoCanoneCents, 8000);
  assert.equal(s[1].ricavoCanoneCents, 8000);
  assert.equal(s[0].sacchi, 2); // la più recente è in cima
});

test("una settimana con un extra ma senza ritiri compare lo stesso", () => {
  // È la riga che si va a cercare: soldi in una settimana in cui non abbiamo
  // lavorato. Se sparisse, non lo scoprirebbe nessuno.
  const s = settimaneDiCompetenza([], [], new Map([["2026-09-14", 630]]), new Map());
  assert.equal(s.length, 1);
  assert.equal(s[0].ricavoExtraCents, 630);
  assert.equal(s[0].ritiri, 0);
});

test("il margine sottrae il costo dall'imponibile, non dal lordo", () => {
  // 122,00 € lordi = 100,00 € imponibili. Con 40,00 € di costo il margine è 60,
  // non 82: sottrarre dal lordo gonfierebbe il margine dell'IVA.
  const s = {
    settimana: "2026-09-14",
    ritiri: 1,
    sacchi: 1,
    ricavoCanoneCents: 12200,
    ricavoExtraCents: 0,
    costoCents: 4000,
  };
  assert.equal(margineCents(s), 6000);
});

test("il margine può essere negativo e lo deve dire", () => {
  const s = {
    settimana: "2026-09-14",
    ritiri: 1,
    sacchi: 3,
    ricavoCanoneCents: 1220,
    ricavoExtraCents: 0,
    costoCents: 3690,
  };
  assert.ok(margineCents(s) < 0);
});
