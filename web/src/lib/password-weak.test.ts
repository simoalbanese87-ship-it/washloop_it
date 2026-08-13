import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordFacile } from "./password-weak.ts";

test("riconosce le password comuni, anche travestite", () => {
  for (const p of ["password", "Password1", "p4ssw0rd", "PASSWORD123", "juventus", "Juventus!", "mammacasa"]) {
    assert.equal(passwordFacile(p), true, `doveva essere segnalata: ${p}`);
  }
});

test("riconosce cifre, sequenze e file di tastiera", () => {
  for (const p of ["12345678", "87654321", "abcdefgh", "qwertyui", "asdfghjk", "01011990"]) {
    assert.equal(passwordFacile(p), true, `doveva essere segnalata: ${p}`);
  }
});

test("riconosce le ripetizioni", () => {
  for (const p of ["aaaaaaaa", "abababab", "ciaociaociao", "xyzxyzxyz"]) {
    assert.equal(passwordFacile(p), true, `doveva essere segnalata: ${p}`);
  }
});

test("riconosce il proprio nome o la propria email dentro la password", () => {
  assert.equal(passwordFacile("simone2024!", "simone.albanese@gmail.com", "Simone Albanese"), true);
  assert.equal(passwordFacile("Albanese88", undefined, "Simone Albanese"), true);
  assert.equal(passwordFacile("marioRossi9", "mario.rossi@libero.it"), true);
});

test("lascia passare una password ragionevole", () => {
  for (const p of ["Bucato-Fresco-92", "vRk8tnQzp2", "lavatriceViola!7", "TreGattiRossi"]) {
    assert.equal(passwordFacile(p, "cliente@example.com", "Anna Verdi"), false, `non doveva essere segnalata: ${p}`);
  }
});

test("sotto gli 8 caratteri tace: se ne occupa già il minimo del campo", () => {
  assert.equal(passwordFacile("ciao"), false);
  assert.equal(passwordFacile("1234"), false);
});

test("non esplode con input vuoto o strano", () => {
  assert.equal(passwordFacile(""), false);
  assert.equal(passwordFacile("        "), true); // 8 spazi: un solo carattere distinto
  assert.equal(passwordFacile("èèèèèèèè"), true);
});
