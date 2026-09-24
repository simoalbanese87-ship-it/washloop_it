import { test } from "node:test";
import assert from "node:assert/strict";
import { messaggioAuth } from "./auth-messaggi.ts";

test("«User already registered» diventa un consiglio, non un rimprovero in inglese", () => {
  // È il messaggio che è comparso davvero sotto il campo password.
  const out = messaggioAuth("User already registered");
  assert.ok(out.includes("Accedi"), out);
  assert.ok(!/[A-Za-z]+ already registered/i.test(out), out);
});

test("riconosce la formulazione anche se Supabase la cambia", () => {
  assert.equal(
    messaggioAuth("Email address has already been registered"),
    messaggioAuth("User already registered"),
  );
});

test("credenziali sbagliate e email non confermata hanno testi distinti", () => {
  const a = messaggioAuth("Invalid login credentials");
  const b = messaggioAuth("Email not confirmed");
  assert.notEqual(a, b);
  assert.ok(a.toLowerCase().includes("password"));
  assert.ok(b.toLowerCase().includes("email"));
});

test("il limite di tentativi non sembra un errore dell'utente", () => {
  for (const grezzo of ["Email rate limit exceeded", "For security purposes, you can only request this after 40 seconds"]) {
    assert.ok(messaggioAuth(grezzo).includes("Riprova"), grezzo);
  }
});

test("quello che non conosciamo passa così com'è, senza inventare", () => {
  assert.equal(messaggioAuth("Qualcosa di mai visto prima"), "Qualcosa di mai visto prima");
});

test("un errore vuoto non lascia la persona senza spiegazione", () => {
  for (const v of ["", null, undefined, "   "]) {
    assert.ok(messaggioAuth(v).length > 0);
  }
});
