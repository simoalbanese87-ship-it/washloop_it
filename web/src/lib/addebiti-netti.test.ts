import { test } from "node:test";
import assert from "node:assert/strict";
import { saldoAddebiti } from "./addebiti-netti.ts";

const capo = (o: Partial<Parameters<typeof saldoAddebiti>[0][number]> = {}) => ({
  qty: 1,
  price_cli_cents: 350,
  charged_at: "2026-09-01T00:00:00Z",
  ...o,
});

test("un capo addebitato e basta: si paga", () => {
  const s = saldoAddebiti([capo()], []);
  assert.equal(s.addebitatoCents, 350);
  assert.equal(s.stornatoCents, 0);
  assert.equal(s.nettoCents, 350);
});

test("addebitato e poi rimborsato fa zero, non meno di zero", () => {
  // È la lettura che il numero vecchio sbagliava: mostrava −350.
  const s = saldoAddebiti([capo({ refunded_at: "2026-09-02T00:00:00Z", refund_ref: "re_1" })], []);
  assert.equal(s.nettoCents, 0);
  assert.equal(s.addebitatoCents, 350);
  assert.equal(s.stornatoCents, 350);
});

test("un capo annullato non è mai stato un addebito e non è denaro uscito", () => {
  const s = saldoAddebiti([capo({ charged_at: null, annullato_at: "2026-09-02T00:00:00Z" })], []);
  assert.equal(s.addebitatoCents, 0);
  assert.equal(s.stornatoCents, 0);
  assert.equal(s.nettoCents, 0);
  assert.equal(s.annullatoCents, 350);
});

test("la riga gemella di un rimborso non si conta due volte", () => {
  const s = saldoAddebiti(
    [capo({ refunded_at: "2026-09-02T00:00:00Z", refund_ref: "re_1" })],
    [{ amount_cents: 350, kind: "refund", status: "settled", stripe_ref: "re_1" }],
  );
  assert.equal(s.stornatoCents, 350);
  assert.equal(s.nettoCents, 0);
});

test("uno storno senza riferimento Stripe non è denaro uscito", () => {
  // È la riga da 21 € di Giulia: «Addebito annullato», nessun soldo mosso.
  const s = saldoAddebiti([], [{ amount_cents: 2100, kind: "refund", status: "settled", stripe_ref: null }]);
  assert.equal(s.stornatoCents, 0);
  assert.equal(s.nettoCents, 0);
});

test("un addebito manuale conta, uno annullato no", () => {
  const s = saldoAddebiti([], [
    { amount_cents: 1000, kind: "charge", status: "settled" },
    { amount_cents: 500, kind: "charge", status: "void" },
  ]);
  assert.equal(s.nettoCents, 1000);
});

test("il caso vero di Giulia deve dare zero, non −35,00 €", () => {
  // Tre capi: 3 camicie rimborsate, 6 annullate, 1 rimborsata. In
  // customer_charges le tre righe gemelle, di cui una senza riferimento Stripe.
  const s = saldoAddebiti(
    [
      { qty: 3, price_cli_cents: 350, charged_at: "2026-09-09T00:00:00Z", refunded_at: "2026-09-09T00:00:00Z", refund_ref: "re_3UDho" },
      { qty: 6, price_cli_cents: 350, charged_at: null, annullato_at: "2026-09-10T00:00:00Z" },
      { qty: 1, price_cli_cents: 350, charged_at: "2026-09-25T00:00:00Z", refunded_at: "2026-09-25T00:00:00Z", refund_ref: "re_3UJYZ" },
    ],
    [
      { amount_cents: 2100, kind: "refund", status: "settled", stripe_ref: null },
      { amount_cents: 1050, kind: "refund", status: "settled", stripe_ref: "re_3UDho" },
      { amount_cents: 350, kind: "refund", status: "settled", stripe_ref: "re_3UJYZ" },
    ],
  );
  assert.equal(s.addebitatoCents, 1400);
  assert.equal(s.stornatoCents, 1400);
  assert.equal(s.nettoCents, 0);
  assert.equal(s.annullatoCents, 2100);
});

test("gli aggiustamenti di canone stanno fuori dal saldo degli extra", () => {
  // Federica: 110,00 € resi e 72,00 € di conguaglio per il passaggio al solo
  // stiro. Prima il saldo diceva −38,00 € sotto l'etichetta «quanto ha pagato
  // in più del canone»: falsa due volte, perché quei soldi *sono* il canone e
  // il canone l'ha pagato per intero.
  const s = saldoAddebiti(
    [],
    [
      { amount_cents: 7200, kind: "charge", status: "settled", categoria: "canone" },
      { amount_cents: 11000, kind: "refund", status: "settled", stripe_ref: "re_1", categoria: "canone" },
    ],
  );
  assert.equal(s.addebitatoCents, 0);
  assert.equal(s.stornatoCents, 0);
  assert.equal(s.nettoCents, 0);
  assert.equal(s.aggiustamentiCanoneCents, 18200);
});

test("un addebito di servizio resta un extra", () => {
  const s = saldoAddebiti([], [{ amount_cents: 2000, kind: "charge", status: "settled", categoria: "servizio" }]);
  assert.equal(s.addebitatoCents, 2000);
  assert.equal(s.aggiustamentiCanoneCents, 0);
});
