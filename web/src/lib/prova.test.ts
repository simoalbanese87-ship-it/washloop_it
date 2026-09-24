import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataAddebito,
  vaAggiornata,
  paracadute,
  tetto,
  GIORNI_PER_PRENOTARE,
  TETTO_GIORNI,
  MARGINE_ORE,
} from "./prova.ts";

const ORA = 3600_000;
const GIORNO = 24 * ORA;
// Un lunedì, per poter dire «martedì → sabato» senza contare sulle dita.
const INIZIO = "2026-10-05T09:00:00.000Z";
const ADESSO = Date.parse(INIZIO);

test("senza nessuna ancora si paga al paracadute", () => {
  const r = dataAddebito(null, INIZIO, { adesso: ADESSO });
  assert.equal(r.origine, "paracadute");
  assert.equal(r.clampato, null);
  assert.equal(r.quando, paracadute(INIZIO));
});

test("col solo ritiro: ritiro + turnaround + un giorno", () => {
  // Ritiro martedì, 72 ore di lavorazione, addebito il sabato.
  const ritiro = "2026-10-06T09:00:00.000Z";
  const r = dataAddebito({ ritiroIso: ritiro, turnaroundOre: 72 }, INIZIO, { adesso: ADESSO });
  assert.equal(r.origine, "ritiro");
  assert.equal(r.quando, new Date(Date.parse(ritiro) + 72 * ORA + 24 * ORA).toISOString());
  assert.equal(new Date(r.quando).getUTCDay(), 6); // sabato
});

test("la fascia di riconsegna concordata batte tutto il resto", () => {
  const r = dataAddebito(
    {
      ritiroIso: "2026-10-06T09:00:00.000Z",
      etaProntoIso: "2026-10-09T09:00:00.000Z",
      riconsegnaIso: "2026-10-08T17:00:00.000Z",
      turnaroundOre: 72,
    },
    INIZIO,
    { adesso: ADESSO },
  );
  assert.equal(r.origine, "riconsegna");
  assert.equal(r.quando, "2026-10-09T17:00:00.000Z");
});

test("l'ETA già mostrata vince sul ricalcolo dal ritiro", () => {
  // Le due date non devono poter divergere: l'ETA è il numero che il cliente ha
  // già letto, e qui la seconda data è un addebito.
  const r = dataAddebito(
    { ritiroIso: "2026-10-06T09:00:00.000Z", etaProntoIso: "2026-10-10T09:00:00.000Z", turnaroundOre: 72 },
    INIZIO,
    { adesso: ADESSO },
  );
  assert.equal(r.origine, "eta");
  assert.equal(r.quando, "2026-10-11T09:00:00.000Z");
});

test("un piano più veloce sposta l'addebito prima", () => {
  const ritiro = "2026-10-06T09:00:00.000Z";
  const r = dataAddebito({ ritiroIso: ritiro, turnaroundOre: 24 }, INIZIO, { adesso: ADESSO });
  assert.equal(r.quando, new Date(Date.parse(ritiro) + 48 * ORA).toISOString());
});

test("un'ancora lontanissima viene riportata al tetto", () => {
  const r = dataAddebito({ ritiroIso: "2027-01-01T09:00:00.000Z", turnaroundOre: 72 }, INIZIO, { adesso: ADESSO });
  assert.equal(r.clampato, "tetto");
  assert.equal(r.quando, tetto(INIZIO));
});

test("un ritiro nel passato non produce una data che Stripe rifiuterebbe", () => {
  const r = dataAddebito({ ritiroIso: "2026-09-01T09:00:00.000Z", turnaroundOre: 72 }, INIZIO, { adesso: ADESSO });
  assert.equal(r.clampato, "minimo");
  assert.equal(r.quando, new Date(ADESSO + MARGINE_ORE * ORA).toISOString());
});

test("una data prima del paracadute passa senza clamp: anticipare l'incasso è permesso", () => {
  const ritiro = "2026-10-06T09:00:00.000Z";
  const r = dataAddebito({ ritiroIso: ritiro, turnaroundOre: 72 }, INIZIO, { adesso: ADESSO });
  assert.ok(Date.parse(r.quando) < Date.parse(paracadute(INIZIO)));
  assert.equal(r.clampato, null);
});

test("date malformate non producono Invalid Date né eccezioni", () => {
  for (const rotto of ["", "non-una-data", "2026-13-45T99:99:99Z"]) {
    const r = dataAddebito({ ritiroIso: rotto, riconsegnaIso: rotto, etaProntoIso: rotto }, INIZIO, { adesso: ADESSO });
    assert.equal(r.origine, "paracadute");
    assert.ok(!r.quando.includes("Invalid"));
    assert.ok(Number.isFinite(Date.parse(r.quando)));
  }
});

test("invariante: qualunque ancora, mai oltre il tetto e mai sotto il minimo", () => {
  // Sono le due garanzie contro il «gratis per sempre»: vanno affermate su
  // tutto lo spazio dei casi, non su tre esempi scelti bene.
  const limite = Date.parse(tetto(INIZIO));
  const minimo = ADESSO + MARGINE_ORE * ORA;
  for (let i = 0; i < 500; i++) {
    const salto = (Math.random() * 400 - 200) * GIORNO; // da -200 a +200 giorni
    const iso = new Date(ADESSO + salto).toISOString();
    for (const a of [{ ritiroIso: iso }, { etaProntoIso: iso }, { riconsegnaIso: iso }]) {
      const r = dataAddebito({ ...a, turnaroundOre: 72 }, INIZIO, { adesso: ADESSO });
      const t = Date.parse(r.quando);
      assert.ok(t <= limite || t === minimo, `oltre il tetto: ${r.quando}`);
      assert.ok(t >= minimo, `sotto il minimo: ${r.quando}`);
    }
  }
});

test("il paracadute e il tetto sono i giorni che diciamo", () => {
  assert.equal(paracadute(INIZIO), new Date(ADESSO + GIORNI_PER_PRENOTARE * GIORNO).toISOString());
  assert.equal(tetto(INIZIO), new Date(ADESSO + TETTO_GIORNI * GIORNO).toISOString());
});

test("vaAggiornata: si chiama Stripe solo se la data cambia davvero", () => {
  const base = "2026-10-10T09:00:00.000Z";
  assert.equal(vaAggiornata(null, base), true);
  assert.equal(vaAggiornata(base, base), false);
  assert.equal(vaAggiornata(base, "2026-10-10T09:30:00.000Z"), false); // mezz'ora
  assert.equal(vaAggiornata(base, "2026-10-10T11:00:00.000Z"), true); // due ore
  assert.equal(vaAggiornata(base, "non-una-data"), false); // niente da scrivere
});
