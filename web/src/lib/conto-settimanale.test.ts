import { test } from "node:test";
import assert from "node:assert/strict";
import {
  settimaneDelMese,
  quotaSettimanale,
  canoneDellaSettimana,
  contoDelMese,
  totaliPerSettimana,
  ricaviDi,
  costiDi,
  lunediDi,
  type CanoneStorico,
} from "./conto-settimanale.ts";

// I martedì di settembre 2026: 1, 8, 15, 22, 29 — cinque.
const MARTEDI_SET = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"].map((d) => `${d}T06:30:00.000Z`);
// I martedì di ottobre 2026: 6, 13, 20, 27 — quattro.
const MARTEDI_OTT = ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"].map((d) => `${d}T06:30:00.000Z`);

test("le colonne sono le settimane in cui si ritira davvero", () => {
  const s = settimaneDelMese([...MARTEDI_SET, ...MARTEDI_OTT], "2026-09");
  assert.deepEqual(s, ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
});

test("un mese con quattro martedì e uno con cinque danno divisori diversi", () => {
  // È il punto segnalato: la stessa settimana vale meno in un mese lungo.
  assert.equal(settimaneDelMese(MARTEDI_SET, "2026-09").length, 5);
  assert.equal(settimaneDelMese(MARTEDI_OTT, "2026-10").length, 4);
  assert.equal(quotaSettimanale(16000, 4), 4000);
  assert.equal(quotaSettimanale(16000, 5), 3200);
});

test("senza settimane non si divide per zero", () => {
  assert.equal(quotaSettimanale(16000, 0), 0);
});

test("una settimana chiusa non conta come settimana", () => {
  // Quattro martedì su cinque: la quinta settimana non esiste e il canone si
  // divide per quattro, non per cinque.
  const senzaUltimo = MARTEDI_SET.slice(0, 4);
  assert.equal(settimaneDelMese(senzaUltimo, "2026-09").length, 4);
});

const CANONI: CanoneStorico[] = [
  { clienteId: "giulia", canoneCents: 16000, daIso: "2026-08-01T00:00:00.000Z" },
  // fabia cambia piano a metà mese: 120 € fino al 7 settembre, poi 70 €.
  { clienteId: "fabia", canoneCents: 12000, daIso: "2026-08-01T00:00:00.000Z" },
  { clienteId: "fabia", canoneCents: 7000, daIso: "2026-09-08T10:00:00.000Z" },
];

test("vale il canone in vigore in quella settimana, non l'ultimo", () => {
  assert.equal(canoneDellaSettimana(CANONI, "fabia", "2026-08-31"), 12000);
  assert.equal(canoneDellaSettimana(CANONI, "fabia", "2026-09-07"), 7000);
  assert.equal(canoneDellaSettimana(CANONI, "fabia", "2026-09-14"), 7000);
});

test("chi non era ancora cliente vale zero, non l'ultimo prezzo", () => {
  assert.equal(canoneDellaSettimana(CANONI, "giulia", "2026-07-20"), 0);
  // La settimana in cui l'abbonamento comincia vale: il canone è partito lì.
  assert.equal(canoneDellaSettimana(CANONI, "giulia", "2026-07-27"), 16000);
});

test("il lunedì si calcola in ora di Roma", () => {
  assert.equal(lunediDi("2026-09-20T22:30:00.000Z"), "2026-09-21");
  assert.equal(lunediDi("2026-09-20T21:30:00.000Z"), "2026-09-14");
});

test("il canone matura solo nelle settimane con una presa in carico", () => {
  // federica arriva a metà mese: le prime due caselle restano vuote, non zero
  // spalmato sulle altre.
  const righe = contoDelMese({
    clienti: [{ clienteId: "federica", nome: "federica" }],
    settimane: ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"],
    canoni: [{ clienteId: "federica", canoneCents: 6000, daIso: "2026-09-10T00:00:00.000Z" }],
    ordini: [
      { clienteId: "federica", settimana: "2026-09-14", sacchi: 1 },
      { clienteId: "federica", settimana: "2026-09-21", sacchi: 1 },
    ],
    payouts: [],
    extra: [],
  });
  assert.equal(righe.length, 1);
  assert.equal(Object.keys(righe[0].celle).length, 2);
  assert.equal(righe[0].celle["2026-09-14"].ricavoCanoneCents, 1500);
  assert.equal(righe[0].totale.ricavoCanoneCents, 3000);
});

test("costi separati: il sacco da una parte, i capi dall'altra", () => {
  const righe = contoDelMese({
    clienti: [{ clienteId: "giulia", nome: "Giulia" }],
    settimane: ["2026-09-07"],
    canoni: CANONI,
    ordini: [{ clienteId: "giulia", settimana: "2026-09-07", sacchi: 1 }],
    payouts: [
      { clienteId: "giulia", settimana: "2026-09-07", kind: "bag", amountCents: 1230 },
      { clienteId: "giulia", settimana: "2026-09-07", kind: "special", amountCents: 205 },
    ],
    extra: [{ clienteId: "giulia", settimana: "2026-09-07", prezzoCents: 350 }],
  });
  const c = righe[0].celle["2026-09-07"];
  assert.equal(c.costoSaccoCents, 1230);
  assert.equal(c.costoExtraCents, 205);
  assert.equal(c.ricavoExtraCents, 350);
  assert.equal(ricaviDi(c), 16000 + 350);
  assert.equal(costiDi(c), 1435);
});

test("quello che cade fuori dalle settimane mostrate non si somma di nascosto", () => {
  // Un costo di una settimana che non è fra le colonne sparirebbe dal totale
  // senza dirlo: meglio escluderlo del tutto che falsare la riga.
  const righe = contoDelMese({
    clienti: [{ clienteId: "giulia", nome: "Giulia" }],
    settimane: ["2026-09-07"],
    canoni: CANONI,
    ordini: [{ clienteId: "giulia", settimana: "2026-09-07", sacchi: 1 }],
    payouts: [{ clienteId: "giulia", settimana: "2026-10-05", kind: "bag", amountCents: 9999 }],
    extra: [],
  });
  assert.equal(righe[0].totale.costoSaccoCents, 0);
});

test("chi nel mese non ha niente non compare", () => {
  const righe = contoDelMese({
    clienti: [{ clienteId: "a", nome: "A" }, { clienteId: "b", nome: "B" }],
    settimane: ["2026-09-07"],
    canoni: [],
    ordini: [{ clienteId: "a", settimana: "2026-09-07", sacchi: 1 }],
    payouts: [],
    extra: [],
  });
  assert.deepEqual(righe.map((r) => r.clienteId), ["a"]);
});

test("i totali di colonna sommano quello che si vede", () => {
  const settimane = ["2026-09-07", "2026-09-14"];
  const righe = contoDelMese({
    clienti: [{ clienteId: "giulia", nome: "Giulia" }, { clienteId: "fabia", nome: "fabia" }],
    settimane,
    canoni: CANONI,
    ordini: [
      { clienteId: "giulia", settimana: "2026-09-07", sacchi: 1 },
      { clienteId: "fabia", settimana: "2026-09-07", sacchi: 2 },
    ],
    payouts: [{ clienteId: "fabia", settimana: "2026-09-14", kind: "bag", amountCents: 1230 }],
    extra: [],
  });
  const t = totaliPerSettimana(righe, settimane);
  assert.equal(t[0].ritiri, 2);
  assert.equal(t[0].sacchi, 3);
  assert.equal(t[0].ricavoCanoneCents, 8000 + 3500);
  assert.equal(t[1].costoSaccoCents, 1230);
});
