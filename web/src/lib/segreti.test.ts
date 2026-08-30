import { test } from "node:test";
import assert from "node:assert/strict";
import { ripulisci } from "./segreti.ts";

/** Non è un caso di scuola: il primo guasto vero registrato in produzione era
 *  un TypeError di `Headers.set` che riportava per intero la chiave di servizio
 *  Supabase. È finita in tabella e da lì nell'email agli admin. */
const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjbGV5cWJudHhhaXd1dGRoZHB4In0.8zHUa0rXcj4OtqXX2gsOytYInlZdggaq";

test("una chiave JWT non passa mai nel registro", () => {
  const out = ripulisci(`Headers.set: "${JWT}" is an invalid header value.`);
  assert.ok(!out.includes("eyJ"), out);
  assert.ok(out.includes("[credenziale rimossa]"));
  // Il resto del messaggio deve restare leggibile, altrimenti il guasto è inutile.
  assert.ok(out.includes("is an invalid header value"));
});

test("anche le chiavi Stripe e i token Supabase", () => {
  for (const segreto of ["sk_live_abcdef1234567890", "whsec_abcdef1234567890", "sbp_abcdef1234567890"]) {
    const out = ripulisci(`errore con ${segreto} dentro`);
    assert.ok(!out.includes(segreto), `non rimosso: ${segreto}`);
  }
});

test("un'intestazione Bearer non lascia passare il token", () => {
  const out = ripulisci("Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456");
  assert.ok(!out.includes("abcdefghijklmnopqrstuvwxyz123456"), out);
});

test("un messaggio senza segreti resta identico", () => {
  const msg = "Cron dunning fallito: connessione rifiutata";
  assert.equal(ripulisci(msg), msg);
});

test("più segreti nello stesso messaggio spariscono tutti", () => {
  const out = ripulisci(`primo ${JWT} e poi sk_live_9876543210abcdef`);
  assert.ok(!out.includes("eyJ") && !out.includes("sk_live_"), out);
});
