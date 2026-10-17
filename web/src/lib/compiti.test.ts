import { test } from "node:test";
import assert from "node:assert/strict";
import { decidiCompiti, giornoRoma, piuGiorni, serveDotazione, haMaterialeNostro, type StatoCliente } from "./compiti.ts";

/** Un lunedì di ottobre, ore 10 italiane. */
const ADESSO = Date.parse("2026-10-19T08:00:00Z");
const OGGI = "2026-10-19";

const base: StatoCliente = {
  stato: "active",
  disdettaProgrammata: false,
  finePeriodoIso: null,
  tagConsegnatiAt: null,
  borsaConsegnataAt: null,
  materialeRientratoAt: null,
};

test("il giorno civile è quello italiano, non quello UTC", () => {
  // 23:30 del 19 a Roma sono le 21:30 UTC: il giorno è ancora il 19.
  assert.equal(giornoRoma(Date.parse("2026-10-19T21:30:00Z")), "2026-10-19");
  // E a mezzanotte e mezza italiana siamo già al 20, anche se in UTC è il 19.
  assert.equal(giornoRoma(Date.parse("2026-10-19T22:30:00Z")), "2026-10-20");
});

test("piuGiorni resta sul giorno civile anche attraverso il cambio dell'ora", () => {
  assert.equal(piuGiorni("2026-10-19", 3), "2026-10-22");
  // L'ora solare arriva il 25 ottobre 2026: il giorno dopo è il 26, non il 25.
  assert.equal(piuGiorni("2026-10-25", 1), "2026-10-26");
  assert.equal(piuGiorni("2026-12-30", 7), "2027-01-06");
});

test("al cliente nuovo serve la dotazione, con tre giorni di tempo", () => {
  const d = decidiCompiti(base, ADESSO);
  assert.deepEqual(d.daCreare, [{ tipo: "dotazione", visibileDal: OGGI, scadeIl: "2026-10-22" }]);
});

test("chi ha già tutto non genera niente da fare", () => {
  const d = decidiCompiti(
    { ...base, tagConsegnatiAt: "2026-10-01T10:00:00Z", borsaConsegnataAt: "2026-10-01T10:00:00Z" },
    ADESSO,
  );
  assert.deepEqual(d.daCreare, []);
});

test("i cartellini da soli non bastano: il sacco è un'altra cosa", () => {
  assert.equal(serveDotazione({ ...base, tagConsegnatiAt: "2026-10-01T10:00:00Z" }), true);
  assert.equal(serveDotazione({ ...base, borsaConsegnataAt: "2026-10-01T10:00:00Z" }), true);
  assert.equal(
    serveDotazione({ ...base, tagConsegnatiAt: "2026-10-01T10:00:00Z", borsaConsegnataAt: "2026-10-01T10:00:00Z" }),
    false,
  );
});

test("la prova gratuita è un cliente come gli altri: il sacco gli serve subito", () => {
  const d = decidiCompiti({ ...base, stato: "trialing" }, ADESSO);
  assert.equal(d.daCreare[0]?.tipo, "dotazione");
});

test("la pausa non fa nascere nessun rientro, e non annulla niente", () => {
  const d = decidiCompiti(
    { ...base, stato: "paused", tagConsegnatiAt: "2026-10-01T10:00:00Z", borsaConsegnataAt: "2026-10-01T10:00:00Z" },
    ADESSO,
  );
  assert.deepEqual(d.daCreare, []);
  assert.deepEqual(d.daAnnullare, []);
});

test("in pausa senza aver mai ricevuto il sacco: la dotazione aperta resta aperta", () => {
  const d = decidiCompiti({ ...base, stato: "paused" }, ADESSO);
  assert.deepEqual(d.daCreare, []);
  assert.equal(d.daAnnullare.includes("dotazione"), false);
});

test("disdetta programmata: il rientro nasce ora ma si vede dal giorno dopo la fine", () => {
  const d = decidiCompiti(
    {
      ...base,
      disdettaProgrammata: true,
      finePeriodoIso: "2026-11-28T09:00:00Z",
      tagConsegnatiAt: "2026-10-01T10:00:00Z",
      borsaConsegnataAt: "2026-10-01T10:00:00Z",
    },
    ADESSO,
  );
  assert.deepEqual(d.daCreare, [{ tipo: "rientro", visibileDal: "2026-11-29", scadeIl: "2026-12-06" }]);
  // E non si annulla la dotazione: paga ancora, il servizio gli spetta.
  assert.deepEqual(d.daAnnullare, []);
});

test("disdetta programmata a chi non ha mai ricevuto niente: niente da riprendere", () => {
  const d = decidiCompiti({ ...base, disdettaProgrammata: true, finePeriodoIso: "2026-11-28T09:00:00Z" }, ADESSO);
  assert.deepEqual(d.daCreare, []);
});

test("abbonamento chiuso: il rientro si vede oggi e la dotazione non fatta si annulla", () => {
  const d = decidiCompiti({ ...base, stato: "canceled", tagConsegnatiAt: "2026-10-01T10:00:00Z" }, ADESSO);
  assert.deepEqual(d.daCreare, [{ tipo: "rientro", visibileDal: OGGI, scadeIl: "2026-10-26" }]);
  assert.deepEqual(d.daAnnullare, ["dotazione"]);
});

test("chi torna dopo aver restituito tutto riceve una dotazione nuova", () => {
  // Le date della prima consegna restano scritte: a dire che oggi non ha
  // niente in mano è `materiale_rientrato_at`.
  const d = decidiCompiti(
    {
      ...base,
      tagConsegnatiAt: "2026-03-01T10:00:00Z",
      borsaConsegnataAt: "2026-03-01T10:00:00Z",
      materialeRientratoAt: "2026-06-30T10:00:00Z",
    },
    ADESSO,
  );
  assert.deepEqual(d.daCreare, [{ tipo: "dotazione", visibileDal: OGGI, scadeIl: "2026-10-22" }]);
});

test("chiuso e materiale già rientrato: non si torna a prenderlo", () => {
  const d = decidiCompiti(
    {
      ...base,
      stato: "canceled",
      tagConsegnatiAt: "2026-10-01T10:00:00Z",
      borsaConsegnataAt: "2026-10-01T10:00:00Z",
      materialeRientratoAt: "2026-10-18T10:00:00Z",
    },
    ADESSO,
  );
  assert.deepEqual(d.daCreare, []);
  assert.equal(haMaterialeNostro({ ...base, tagConsegnatiAt: "x", materialeRientratoAt: "y" }), false);
});

test("il ripensamento: chi riprende l'abbonamento si porta via il rientro", () => {
  // È il difetto più probabile di tutto il giro: il rientro resta aperto e il
  // rider si presenta a riprendersi il sacco di un cliente attivo.
  const d = decidiCompiti(
    { ...base, tagConsegnatiAt: "2026-10-01T10:00:00Z", borsaConsegnataAt: "2026-10-01T10:00:00Z" },
    ADESSO,
  );
  assert.deepEqual(d.daAnnullare, ["rientro"]);
});

test("gli stati di passaggio di Stripe non decidono niente", () => {
  for (const stato of ["incomplete", "past_due", "unpaid", "incomplete_expired", null, ""]) {
    const d = decidiCompiti({ ...base, stato, tagConsegnatiAt: "2026-10-01T10:00:00Z" }, ADESSO);
    assert.deepEqual(d.daCreare, [], `stato ${stato}`);
    assert.deepEqual(d.daAnnullare, [], `stato ${stato}`);
  }
});

test("disdetta programmata senza data di fine: il rientro si vede oggi, non mai", () => {
  const d = decidiCompiti(
    { ...base, disdettaProgrammata: true, finePeriodoIso: null, borsaConsegnataAt: "2026-10-01T10:00:00Z" },
    ADESSO,
  );
  assert.equal(d.daCreare[0]?.visibileDal, piuGiorni(OGGI, 1));
});
