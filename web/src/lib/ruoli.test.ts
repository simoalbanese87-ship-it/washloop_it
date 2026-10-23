import { test } from "node:test";
import assert from "node:assert/strict";
import { isRuolo, perchéNoCambioRuolo, RUOLI, RUOLO_COSA_VEDE, RUOLO_LABEL } from "./ruoli.ts";

const base = { ioId: "admin-1", utenteId: "tizio", ruoloAttuale: "customer", ruoloNuovo: "admin", quantiAdmin: 1 };

test("promuovere un cliente ad amministratore si può", () => {
  assert.equal(perchéNoCambioRuolo(base), null);
});

test("non ci si cambia il ruolo da soli", () => {
  // È il gesto con cui ci si chiude fuori, e se l'admin era uno non riapre
  // più nessuno.
  const no = perchéNoCambioRuolo({ ...base, utenteId: "admin-1", ruoloAttuale: "admin", ruoloNuovo: "customer" });
  assert.match(no!, /te stesso/);
});

test("l'ultimo amministratore non si declassa", () => {
  const no = perchéNoCambioRuolo({ ...base, utenteId: "altro", ruoloAttuale: "admin", ruoloNuovo: "courier", quantiAdmin: 1 });
  assert.match(no!, /unico amministratore/);
  // Con due, si può: ne resta uno.
  assert.equal(perchéNoCambioRuolo({ ...base, utenteId: "altro", ruoloAttuale: "admin", ruoloNuovo: "courier", quantiAdmin: 2 }), null);
});

test("un ruolo inventato non passa", () => {
  assert.equal(isRuolo("capo"), false);
  assert.equal(isRuolo(""), false);
  assert.match(perchéNoCambioRuolo({ ...base, ruoloNuovo: "capo" })!, /non valido/);
});

test("rimettere lo stesso ruolo non è un cambio", () => {
  assert.match(perchéNoCambioRuolo({ ...base, ruoloAttuale: "admin", ruoloNuovo: "admin", quantiAdmin: 2 })!, /già questo ruolo/);
});

test("ogni ruolo ha un nome e dice cosa apre", () => {
  // Promuovere qualcuno senza sapere cosa gli si apre è il modo in cui si
  // regalano i dati di tutti.
  for (const r of RUOLI) {
    assert.ok(RUOLO_LABEL[r], `manca l'etichetta di ${r}`);
    assert.ok(RUOLO_COSA_VEDE[r].length > 10, `manca cosa vede ${r}`);
  }
});
