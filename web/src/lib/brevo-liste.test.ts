import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterDi, listeDi, appartenenzeDi, LISTA } from "./brevo-liste.ts";

const lead = { haAccount: false, haAvutoAbbonamento: false, disiscritto: false };
const free = { haAccount: true, haAvutoAbbonamento: false, disiscritto: false };
const cliente = { haAccount: true, haAvutoAbbonamento: true, disiscritto: false };

test("chi ha un account e non ha mai pagato è un account free", () => {
  assert.equal(clusterDi(free), "account_free");
});

test("chi ha pagato è cliente, e resta cliente anche dopo la disdetta", () => {
  assert.equal(clusterDi(cliente), "clienti");
  // L'abbonamento chiuso non cambia il cluster: è il dato che abbiamo, la
  // decisione su cosa scrivergli si prende dopo.
  assert.equal(clusterDi({ ...cliente, haAvutoAbbonamento: true }), "clienti");
});

test("la disiscrizione vince su tutto, anche su un cliente", () => {
  assert.equal(clusterDi({ ...cliente, disiscritto: true }), "disiscritto");
  const { dentro, fuori } = listeDi("disiscritto", "solo_stiro");
  assert.deepEqual(dentro, [LISTA.disiscritti]);
  // Anche «Solo stiro»: è una lista di invio, non un'etichetta anagrafica.
  assert.ok(fuori.includes(LISTA.soloStiro));
  assert.ok(fuori.includes(LISTA.clienti));
});

test("l'account free esce dai lead di Meta", () => {
  const { dentro, fuori } = appartenenzeDi(free, null);
  assert.deepEqual(dentro, [LISTA.accountFree]);
  assert.ok(fuori.includes(LISTA.lead));
});

test("il cliente esce sia dai lead sia dagli account free", () => {
  const { dentro, fuori } = appartenenzeDi(cliente, null);
  assert.deepEqual(dentro, [LISTA.clienti]);
  assert.ok(fuori.includes(LISTA.lead));
  assert.ok(fuori.includes(LISTA.accountFree));
});

test("un lead puro non si tocca: in «Lead Meta» ce lo mette la pubblicità", () => {
  const { dentro, fuori } = appartenenzeDi(lead, null);
  assert.deepEqual(dentro, []);
  assert.ok(!fuori.includes(LISTA.lead));
});

test("«solo stiro» si aggiunge al cluster, non lo sostituisce", () => {
  const { dentro } = appartenenzeDi(cliente, "solo_stiro");
  assert.deepEqual(dentro, [LISTA.clienti, LISTA.soloStiro]);
});

test("cambiato il tipo di servizio, dalla lista «Solo stiro» si esce", () => {
  const { dentro, fuori } = appartenenzeDi(cliente, "lava_stira");
  assert.ok(!dentro.includes(LISTA.soloStiro));
  assert.ok(fuori.includes(LISTA.soloStiro));
});

test("nessuna lista compare contemporaneamente dentro e fuori", () => {
  for (const p of [lead, free, cliente, { ...cliente, disiscritto: true }]) {
    for (const t of [null, "solo_stiro", "lava_stira", "solo_lavanderia"] as const) {
      const { dentro, fuori } = appartenenzeDi(p, t);
      for (const l of dentro) assert.ok(!fuori.includes(l), `${l} è dentro e fuori insieme`);
    }
  }
});
