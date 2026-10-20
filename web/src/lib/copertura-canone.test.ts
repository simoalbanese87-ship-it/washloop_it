import { test } from "node:test";
import assert from "node:assert/strict";
import { coperturaDelCanone, type SubCopertura } from "./copertura-canone.ts";

const OGGI = "2026-10-20T08:00:00.000Z";

const base: SubCopertura = {
  user_id: "x",
  status: "active",
  created_at: "2026-09-01T10:00:00.000Z",
  activated_at: "2026-09-01T10:00:00.000Z",
  current_period_end: "2026-11-01T10:00:00.000Z",
  custom_price_cents: 16000,
};

test("un abbonamento attivo copre fino al rinnovo", () => {
  const c = coperturaDelCanone(base, OGGI)!;
  assert.equal(c.canoneCents, 16000);
  assert.equal(c.daIso, "2026-09-01T10:00:00.000Z");
  assert.equal(c.aIso, "2026-11-01T10:00:00.000Z");
});

test("un checkout mai pagato non copre niente", () => {
  assert.equal(coperturaDelCanone({ ...base, status: "incomplete", activated_at: null }, OGGI), null);
  assert.equal(coperturaDelCanone({ ...base, status: "incomplete_expired", activated_at: null }, OGGI), null);
});

test("la prima settimana gratis non è un ricavo", () => {
  // `prova_fine_at` è il giorno del primo addebito: prima di lì non si paga.
  const c = coperturaDelCanone({ ...base, status: "trialing", prova_fine_at: "2026-09-08T10:00:00.000Z" }, OGGI)!;
  assert.equal(c.daIso, "2026-09-08T10:00:00.000Z");
});

test("la disdetta a fine periodo non taglia le settimane pagate", () => {
  // `canceled_at` è quando la disdetta è stata chiesta, non quando finisce.
  const c = coperturaDelCanone(
    {
      ...base,
      status: "canceled",
      cancel_at_period_end: true,
      canceled_at: "2026-10-03T09:00:00.000Z",
      current_period_end: "2026-10-29T09:00:00.000Z",
    },
    OGGI,
  )!;
  assert.equal(c.aIso, "2026-10-29T09:00:00.000Z");
});

test("la disdetta immediata finisce quel giorno", () => {
  const c = coperturaDelCanone(
    {
      ...base,
      status: "canceled",
      cancel_at_period_end: false,
      canceled_at: "2026-10-08T09:00:00.000Z",
      current_period_end: "2026-10-29T09:00:00.000Z",
    },
    OGGI,
  )!;
  assert.equal(c.aIso, "2026-10-08T09:00:00.000Z");
});

test("un pagamento fallito copre fino all'ultimo periodo pagato", () => {
  const c = coperturaDelCanone({ ...base, status: "past_due" }, OGGI)!;
  assert.equal(c.aIso, "2026-11-01T10:00:00.000Z");
  const senzaData = coperturaDelCanone({ ...base, status: "unpaid", current_period_end: null }, OGGI)!;
  assert.equal(senzaData.aIso, null);
});

test("in pausa si resta coperti fino a dove si è pagato", () => {
  const c = coperturaDelCanone({ ...base, status: "paused" }, OGGI)!;
  assert.equal(c.aIso, "2026-11-01T10:00:00.000Z");
});

test("un abbonamento manuale senza rinnovo si ferma a oggi, non all'infinito", () => {
  // Senza tetto, sfogliando un mese futuro comparirebbe un mese di canone per
  // tutti.
  const c = coperturaDelCanone({ ...base, current_period_end: null }, OGGI)!;
  assert.equal(c.aIso, OGGI);
});

test("il prezzo su misura vince sul piano, e senza prezzo non si copre niente", () => {
  const c = coperturaDelCanone({ ...base, custom_price_cents: 7100, prezzoPianoCents: 16000 }, OGGI)!;
  assert.equal(c.canoneCents, 7100);
  const d = coperturaDelCanone({ ...base, custom_price_cents: null, prezzoPianoCents: 16000 }, OGGI)!;
  assert.equal(d.canoneCents, 16000);
  assert.equal(coperturaDelCanone({ ...base, custom_price_cents: null, prezzoPianoCents: null }, OGGI), null);
});

test("un pacchetto a termine si porta dietro la sua durata", () => {
  const c = coperturaDelCanone({ ...base, termina_dopo_settimane: 1, custom_price_cents: 4000 }, OGGI)!;
  assert.equal(c.settimaneCoperte, 1);
});

test("una fine prima dell'inizio non è una copertura", () => {
  assert.equal(
    coperturaDelCanone(
      { ...base, status: "canceled", cancel_at_period_end: false, canceled_at: "2026-08-01T00:00:00.000Z" },
      OGGI,
    ),
    null,
  );
});
