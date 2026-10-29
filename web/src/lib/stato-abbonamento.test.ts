import { test } from "node:test";
import assert from "node:assert/strict";
import { etichettaAbbonamento, rigaQuando } from "./stato-abbonamento.ts";

const FINE = "2026-09-30T00:00:00.000Z";
const data = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

test("un abbonamento che si rinnova dice «Rinnovo»", () => {
  const e = etichettaAbbonamento({ status: "active", periodEnd: FINE });
  assert.equal(e.stato, "Attivo");
  assert.equal(e.quando?.parola, "Rinnovo");
  assert.equal(e.tono, "bene");
  assert.equal(e.disdettaProgrammata, false);
});

test("chi ha disdetto legge «Finisce», non «Rinnovo»", () => {
  // Il caso di fabia: su Stripe resta `active` fino al 30/09, ma non si rinnova.
  // Dirle «Rinnovo il 30/09» le fa credere che la disdetta non abbia funzionato.
  const e = etichettaAbbonamento({ status: "active", cancelAtPeriodEnd: true, periodEnd: FINE });
  assert.equal(e.quando?.parola, "Finisce");
  assert.equal(e.stato, "Attivo, in scadenza");
  assert.equal(e.tono, "attenzione");
  assert.equal(e.disdettaProgrammata, true);
  // Il servizio gli spetta lo stesso: l'ha pagato.
  assert.equal(e.attivo, true);
  assert.equal(rigaQuando(e, data), "Finisce il 30/09");
});

test("durante la prova la data che conta è il primo addebito", () => {
  const e = etichettaAbbonamento({ status: "trialing", periodEnd: FINE, provaFineAt: "2026-10-05T00:00:00.000Z" });
  assert.equal(e.stato, "In prova");
  assert.equal(e.quando?.parola, "Primo addebito");
  assert.equal(e.quando?.iso, "2026-10-05T00:00:00.000Z");
});

test("una prova disdetta dice comunque quando scatta l'addebito", () => {
  const e = etichettaAbbonamento({ status: "trialing", cancelAtPeriodEnd: true, provaFineAt: "2026-10-05T00:00:00.000Z" });
  assert.equal(e.disdettaProgrammata, true);
  assert.equal(e.quando?.parola, "Primo addebito");
});

test("un abbonamento davvero disdetto non è attivo e non si rinnova", () => {
  const e = etichettaAbbonamento({ status: "canceled", periodEnd: FINE });
  assert.equal(e.stato, "Disdetto");
  assert.equal(e.attivo, false);
  assert.equal(e.disdettaProgrammata, false);
  assert.equal(e.quando?.parola, "Fino al");
  assert.equal(e.tono, "finito");
});

test("un pagamento fallito chiede attenzione ma non è finito", () => {
  const e = etichettaAbbonamento({ status: "past_due", periodEnd: FINE });
  assert.equal(e.tono, "attenzione");
  assert.equal(e.attivo, false);
});

test("senza abbonamento, e senza data, non si inventa niente", () => {
  const e = etichettaAbbonamento({ status: null });
  assert.equal(e.stato, "Nessun abbonamento");
  assert.equal(e.quando, null);
  assert.equal(rigaQuando(e, data), null);
});

test("uno stato che non conosciamo si mostra com'è invece di sparire", () => {
  const e = etichettaAbbonamento({ status: "stato_nuovo_di_stripe" });
  assert.equal(e.stato, "stato_nuovo_di_stripe");
});

test("la disdetta «a una data» conta come la disdetta a fine periodo", () => {
  // Stripe ha due campi e ne usa uno solo: `cancel_at_period_end` quando si
  // disdice dal periodo, `cancel_at` quando si sceglie un giorno. Leggendo
  // solo il primo, il 29 ottobre 2026 il pannello diceva «Attivo · rinnovo
  // oggi · 160 €» su un abbonamento che su Stripe aveva «Data di annullamento
  // 29 ott 2026».
  const e = etichettaAbbonamento({
    status: "active",
    cancelAtPeriodEnd: false,
    cancelAt: "2026-10-29T22:00:00.000Z",
    periodEnd: "2026-11-29T22:00:00.000Z",
  });
  assert.equal(e.disdettaProgrammata, true);
  assert.equal(e.stato, "Attivo, in scadenza");
  assert.equal(e.tono, "attenzione");
  // Il servizio gli spetta fino alla data: resta utilizzabile.
  assert.equal(e.attivo, true);
});

test("se la disdetta è a data, la data che si mostra è quella", () => {
  // `periodEnd` direbbe una data più in là di quella in cui il servizio si
  // spegne davvero.
  const e = etichettaAbbonamento({
    status: "active",
    cancelAt: "2026-10-29T22:00:00.000Z",
    periodEnd: "2026-11-29T22:00:00.000Z",
  });
  assert.equal(e.quando?.parola, "Finisce");
  assert.equal(e.quando?.iso, "2026-10-29T22:00:00.000Z");
});

test("senza nessuna delle due, niente cambia", () => {
  const e = etichettaAbbonamento({ status: "active", cancelAtPeriodEnd: false, cancelAt: null, periodEnd: "2026-11-29T22:00:00.000Z" });
  assert.equal(e.disdettaProgrammata, false);
  assert.equal(e.quando?.parola, "Rinnovo");
});
