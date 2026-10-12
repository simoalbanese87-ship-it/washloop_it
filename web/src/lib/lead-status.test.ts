import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTACT_STATUS, CONTACT_STATUS_LABEL, CONTACT_STATUS_TONE, isContactStatus } from "./lead-status.ts";

test("ogni stato ha un'etichetta e un colore: nessuna riga muta in elenco", () => {
  for (const s of CONTACT_STATUS) {
    assert.ok(CONTACT_STATUS_LABEL[s], `manca l'etichetta di ${s}`);
    assert.ok(CONTACT_STATUS_TONE[s], `manca il colore di ${s}`);
  }
});

test("«in attesa di risposta» esiste ed è distinto da «in corso»", () => {
  assert.ok(isContactStatus("in_attesa"));
  assert.notEqual(CONTACT_STATUS_LABEL.in_attesa, CONTACT_STATUS_LABEL.in_corso);
});

test("l'ordine del menu segue il percorso, non l'alfabeto", () => {
  // Si parte da «da contattare», si chiama, si aspetta, e si chiude.
  const i = (s: string) => CONTACT_STATUS.indexOf(s as (typeof CONTACT_STATUS)[number]);
  assert.ok(i("da_contattare") < i("in_corso"));
  assert.ok(i("in_corso") < i("in_attesa"));
  assert.ok(i("in_attesa") < i("convertito"));
});

test("uno stato inventato non passa la validazione", () => {
  // È la guardia che tiene allineato il menu al vincolo in database.
  assert.equal(isContactStatus("richiamato_forse"), false);
  assert.equal(isContactStatus(""), false);
});

test("«fuori zona» è un esito suo, non un rifiuto", () => {
  // Chi è interessato ma sta fuori copertura finiva in «non interessato»: è
  // falso, e cancella la lista da richiamare il giorno che la zona si apre.
  assert.ok(isContactStatus("fuori_zona"));
  assert.notEqual(CONTACT_STATUS_LABEL.fuori_zona, CONTACT_STATUS_LABEL.non_interessato);
  assert.notEqual(CONTACT_STATUS_TONE.fuori_zona, CONTACT_STATUS_TONE.non_interessato);
});
