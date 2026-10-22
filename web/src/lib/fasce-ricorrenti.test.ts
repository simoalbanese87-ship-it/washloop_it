import { test } from "node:test";
import assert from "node:assert/strict";
import { chiaveFascia, fasceDisponibili, fasciaEsiste, leggiChiave, oreDiConsegna } from "./fasce-ricorrenti.ts";

const CALENDARIO = [
  { weekday: 2, hhmm: "08:30", servizio: "lavanderia" },
  { weekday: 1, hhmm: "09:00", servizio: "stiro" },
  { weekday: 1, hhmm: "08:00", servizio: "stiro" },
  { weekday: 3, hhmm: "08:30", servizio: "stiro" },
  // La settimana dopo: stesse fasce, non devono comparire due volte.
  { weekday: 1, hhmm: "08:00", servizio: "stiro" },
  { weekday: 2, hhmm: "08:30", servizio: "lavanderia" },
];

test("le fasce si elencano una volta sola, in ordine di settimana", () => {
  assert.deepEqual(
    fasceDisponibili(CALENDARIO).map(chiaveFascia),
    ["1|08:00", "1|09:00", "2|08:30", "3|08:30"],
  );
});

test("domenica va in fondo alla settimana, non in testa", () => {
  // Nel database è 0, ma per chi lavora è l'ultimo giorno.
  const f = fasceDisponibili([{ weekday: 0, hhmm: "10:00" }, { weekday: 1, hhmm: "08:00" }]);
  assert.deepEqual(f.map(chiaveFascia), ["1|08:00", "0|10:00"]);
});

test("un'ora che il calendario non ha non è una fascia", () => {
  // È il caso che ha fatto sparire i ritiri di un cliente: ricorrenza al
  // lunedì alle 08:30, fasce del lunedì alle 08:00 e alle 09:00.
  assert.equal(fasciaEsiste(1, "08:30", CALENDARIO), false);
  assert.equal(fasciaEsiste(1, "08:00", CALENDARIO), true);
  assert.equal(fasciaEsiste(2, "08:30", CALENDARIO), true);
});

test("la chiave del form si rilegge, e quella storta no", () => {
  assert.deepEqual(leggiChiave("1|08:00"), { weekday: 1, hhmm: "08:00" });
  assert.equal(leggiChiave("7|08:00"), null);
  assert.equal(leggiChiave("1|25:00"), null);
  assert.equal(leggiChiave("1"), null);
  assert.equal(leggiChiave(""), null);
});

test("righe senza senso non entrano nell'elenco", () => {
  const f = fasceDisponibili([
    { weekday: 9, hhmm: "08:00" },
    { weekday: 1, hhmm: "8:00" },
    { weekday: 1, hhmm: "08:00" },
  ]);
  assert.deepEqual(f.map(chiaveFascia), ["1|08:00"]);
});

test("le ore di riconsegna si leggono senza il giorno", () => {
  // Il cron cerca la prima riconsegna a quell'ora dopo che il bucato è
  // pronto, in qualunque giorno cada.
  assert.deepEqual(
    oreDiConsegna([{ weekday: 3, hhmm: "09:00" }, { weekday: 5, hhmm: "09:00" }, { weekday: 5, hhmm: "08:00" }]),
    ["08:00", "09:00"],
  );
});
