import { test } from "node:test";
import assert from "node:assert/strict";
import { riconsegnaPrevista, passaggiDellOrdine } from "./planning-rider.ts";

const MAR = "2026-09-15T06:30:00.000Z"; // martedì 15 settembre, 08:30 a Roma

test("martedì per venerdì: 72 ore esatte", () => {
  const ven = riconsegnaPrevista(MAR);
  assert.equal(new Date(ven).toISOString().slice(0, 10), "2026-09-18");
});

test("un ritiro senza riconsegna fissata produce comunque il suo ritorno", () => {
  const p = passaggiDellOrdine({ id: "a", ritiroIso: MAR, riconsegnaIso: null, etaPronto: null, ritiroFatto: false, chiuso: false });
  assert.equal(p.length, 2);
  assert.equal(p[1].tipo, "riconsegna");
  assert.equal(p[1].confermato, false);
  assert.equal(p[1].quando.slice(0, 10), "2026-09-18");
});

test("la fascia concordata vince sulla previsione", () => {
  const p = passaggiDellOrdine({
    id: "a", ritiroIso: MAR, riconsegnaIso: "2026-09-19T07:00:00.000Z",
    etaPronto: "2026-09-18T06:30:00.000Z", ritiroFatto: false, chiuso: false,
  });
  assert.equal(p[1].confermato, true);
  assert.equal(p[1].quando.slice(0, 10), "2026-09-19");
});

test("l'ETA dell'ordine ha la precedenza sul ricalcolo: due date sullo stesso ordine non devono esistere", () => {
  const p = passaggiDellOrdine({
    id: "a", ritiroIso: MAR, riconsegnaIso: null,
    etaPronto: "2026-09-17T06:30:00.000Z", ritiroFatto: false, chiuso: false,
  });
  assert.equal(p[1].quando.slice(0, 10), "2026-09-17");
});

test("un sacco già ritirato non compare più fra i ritiri, ma il ritorno sì", () => {
  const p = passaggiDellOrdine({ id: "a", ritiroIso: MAR, riconsegnaIso: null, etaPronto: null, ritiroFatto: true, chiuso: false });
  assert.equal(p.length, 1);
  assert.equal(p[0].tipo, "riconsegna");
});

test("un ordine chiuso non ha più passaggi da fare", () => {
  const p = passaggiDellOrdine({ id: "a", ritiroIso: MAR, riconsegnaIso: null, etaPronto: null, ritiroFatto: true, chiuso: true });
  assert.equal(p.length, 0);
});
