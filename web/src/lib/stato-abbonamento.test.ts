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
