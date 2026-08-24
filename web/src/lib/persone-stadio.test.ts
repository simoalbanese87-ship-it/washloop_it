import { test } from "node:test";
import assert from "node:assert/strict";
import { STADI, stadioDaSubscription, vivo } from "./persone-stadio.ts";

const ADESSO = new Date("2026-08-24T12:00:00Z").getTime();
const FUTURO = "2026-09-23T12:00:00Z";
const PASSATO = "2026-07-13T12:00:00Z";

test("gli stadi sono quattro: 'registrato' è stato fuso dentro 'lead'", () => {
  assert.deepEqual([...STADI], ["lead", "attivo", "difficolta", "perso"]);
  assert.ok(!(STADI as readonly string[]).includes("registrato"));
});

test("chi non ha nessuna subscription è un lead, non una categoria a parte", () => {
  assert.equal(stadioDaSubscription(null, ADESSO), "lead");
  assert.equal(stadioDaSubscription(undefined, ADESSO), "lead");
});

test("un checkout aperto e mai concluso resta un lead, non un cliente perso", () => {
  assert.equal(stadioDaSubscription({ status: "incomplete", current_period_end: null }, ADESSO), "lead");
  assert.equal(stadioDaSubscription({ status: "incomplete_expired", current_period_end: null }, ADESSO), "lead");
});

test("paga ed è nel periodo: cliente attivo", () => {
  assert.equal(stadioDaSubscription({ status: "active", current_period_end: FUTURO }, ADESSO), "attivo");
  assert.equal(stadioDaSubscription({ status: "trialing", current_period_end: FUTURO }, ADESSO), "attivo");
});

test("'active' con il periodo già finito non è attivo: è perso", () => {
  // È il caso che gonfiava il ricorrente in dashboard: due account di prova
  // scaduti a luglio continuavano a contare 440 €/mese.
  assert.equal(stadioDaSubscription({ status: "active", current_period_end: PASSATO }, ADESSO), "perso");
});

test("fattura rimasta aperta: pagamento fallito, ed è lo stadio che innesca i solleciti", () => {
  assert.equal(stadioDaSubscription({ status: "past_due", current_period_end: PASSATO }, ADESSO), "difficolta");
  assert.equal(stadioDaSubscription({ status: "unpaid", current_period_end: PASSATO }, ADESSO), "difficolta");
});

test("disdetto o in pausa: cliente perso", () => {
  assert.equal(stadioDaSubscription({ status: "canceled", current_period_end: PASSATO }, ADESSO), "perso");
  assert.equal(stadioDaSubscription({ status: "paused", current_period_end: FUTURO }, ADESSO), "perso");
});

test("senza data di fine, 'active' basta: gli abbonamenti manuali non hanno periodo", () => {
  assert.equal(vivo("active", null, ADESSO), true);
  assert.equal(stadioDaSubscription({ status: "active", current_period_end: null }, ADESSO), "attivo");
});

test("ogni stadio prodotto è uno di quelli dichiarati", () => {
  const casi = ["active", "trialing", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "paused", "boh"];
  for (const status of casi) {
    const s = stadioDaSubscription({ status, current_period_end: FUTURO }, ADESSO);
    assert.ok((STADI as readonly string[]).includes(s), `stadio sconosciuto per ${status}: ${s}`);
  }
});
