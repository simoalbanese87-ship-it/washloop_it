import { test } from "node:test";
import assert from "node:assert/strict";
import { capiDaIncassare, totaleCents } from "./extra-selezione.ts";

const capo = (over: Partial<{ charged_at: string | null; refunded_at: string | null; annullato_at: string | null; qty: number; price_cli_cents: number }> = {}) => ({
  charged_at: null,
  refunded_at: null,
  annullato_at: null,
  qty: 1,
  price_cli_cents: 350,
  ...over,
});

test("entrano solo i capi che nessuno ha ancora chiesto", () => {
  const capi = [
    capo(),
    capo({ charged_at: "2026-09-01T10:00:00Z" }),
    capo({ annullato_at: "2026-09-08T10:00:00Z" }),
    capo({ refunded_at: "2026-09-08T10:00:00Z" }),
  ];
  assert.equal(capiDaIncassare(capi).length, 1);
});

test("un ritiro senza capi non produce nessuna fattura", () => {
  assert.deepEqual(capiDaIncassare([]), []);
});

test("premere «pronto» due volte non riaddebita niente", () => {
  // Dopo il primo incasso i capi hanno charged_at: la seconda chiamata trova
  // la lista vuota ed esce senza creare una seconda fattura. È l'unica cosa
  // che impedisce al cliente di vedersi addebitare due volte lo stesso capo.
  const dopoIlPrimoIncasso = [capo({ charged_at: "2026-09-08T12:00:00Z" }), capo({ charged_at: "2026-09-08T12:00:00Z" })];
  assert.deepEqual(capiDaIncassare(dopoIlPrimoIncasso), []);
});

test("il totale moltiplica per la quantità", () => {
  assert.equal(totaleCents([{ qty: 3, price_cli_cents: 350 }]), 1050);
  assert.equal(totaleCents([{ qty: 1, price_cli_cents: 630 }, { qty: 2, price_cli_cents: 350 }]), 1330);
  assert.equal(totaleCents([]), 0);
});

test("un capo annullato non entra nel totale nemmeno se ha un prezzo", () => {
  const capi = [capo({ price_cli_cents: 630 }), capo({ annullato_at: "2026-09-08T10:00:00Z", price_cli_cents: 350 })];
  assert.equal(totaleCents(capiDaIncassare(capi)), 630);
});
