import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEGNALAZIONE_AIUTO,
  SEGNALAZIONE_AL_CLIENTE,
  SEGNALAZIONE_LABEL,
  SEGNALAZIONE_TONO,
  TIPI_SEGNALAZIONE,
  avvisaSubitoIlCliente,
  fotoObbligatoria,
  isTipoSegnalazione,
} from "./segnalazioni.ts";

test("il danno non raggiunge il cliente da solo", () => {
  assert.equal(avvisaSubitoIlCliente("danno"), false);
});

test("le altre due segnalazioni partono subito", () => {
  assert.equal(avvisaSubitoIlCliente("trovato_cosi"), true);
  assert.equal(avvisaSubitoIlCliente("non_rimosso"), true);
});

test("la foto è obbligatoria solo sul danno", () => {
  assert.equal(fotoObbligatoria("danno"), true);
  assert.equal(fotoObbligatoria("trovato_cosi"), false);
  assert.equal(fotoObbligatoria("non_rimosso"), false);
});

test("solo i tre tipi previsti passano la validazione", () => {
  for (const t of TIPI_SEGNALAZIONE) assert.equal(isTipoSegnalazione(t), true);
  assert.equal(isTipoSegnalazione("danno "), false);
  assert.equal(isTipoSegnalazione("altro"), false);
  assert.equal(isTipoSegnalazione(""), false);
});

test("ogni tipo ha tutti i testi: nessuna schermata con un buco", () => {
  for (const t of TIPI_SEGNALAZIONE) {
    for (const [nome, mappa] of Object.entries({
      SEGNALAZIONE_LABEL,
      SEGNALAZIONE_AIUTO,
      SEGNALAZIONE_AL_CLIENTE,
      SEGNALAZIONE_TONO,
    })) {
      const v = (mappa as Record<string, string>)[t];
      assert.ok(v && v.length > 0, `manca ${nome}.${t}`);
    }
  }
});
