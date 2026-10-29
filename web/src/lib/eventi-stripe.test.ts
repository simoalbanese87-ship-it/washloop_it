import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENTI_STRIPE_GESTITI, eventiNonAscoltati } from "./eventi-stripe.ts";

test("se su Stripe c'è tutto, non manca niente", () => {
  assert.deepEqual(eventiNonAscoltati([...EVENTI_STRIPE_GESTITI]), []);
});

test("dice quali mancano, non quanti", () => {
  // È il caso vero del 29 ottobre 2026: sei eventi spuntati su otto, e il
  // pannello diceva «6 eventi ascoltati» — verde, e muto su quali due.
  const spuntati = EVENTI_STRIPE_GESTITI.filter(
    (e) => e !== "charge.refunded" && e !== "customer.subscription.trial_will_end",
  );
  assert.deepEqual(eventiNonAscoltati(spuntati).sort(), [
    "charge.refunded",
    "customer.subscription.trial_will_end",
  ]);
});

test("il jolly di Stripe vuol dire «mandami tutto»", () => {
  assert.deepEqual(eventiNonAscoltati(["*"]), []);
  assert.deepEqual(eventiNonAscoltati(["*.*"]), []);
});

test("un endpoint senza niente spuntato manca di tutto", () => {
  assert.equal(eventiNonAscoltati([]).length, EVENTI_STRIPE_GESTITI.length);
});
