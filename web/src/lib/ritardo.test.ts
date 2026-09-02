import { test } from "node:test";
import assert from "node:assert/strict";
import { scegliRiconsegna, nuovaEta, ACCORPA_ENTRO_GIORNI } from "./ritardo.ts";

const f = (id: string, iso: string) => ({ id, starts_at: iso });

// Le date del caso vero del 2 settembre 2026, così i test raccontano qualcosa.
const VENERDI_12 = "2026-09-04T10:00:00+00:00"; // ven 4, 12:00 a Roma
const VENERDI_18 = "2026-09-04T16:00:00+00:00";
const MERCOLEDI_9 = "2026-09-09T10:00:00+00:00";
const VENERDI_11 = "2026-09-11T10:00:00+00:00";
const GIOVEDI_18_SETT = "2026-09-18T10:00:00+00:00";

test("il capo è pronto prima della riconsegna promessa: non si sposta niente", () => {
  const r = scegliRiconsegna("2026-09-03T07:00:00+00:00", f("ven12", VENERDI_12), [], [f("x", VENERDI_18)]);
  assert.deepEqual(r, { esito: "resta", slotId: null });
});

test("pronto esattamente all'apertura della fascia: la fascia regge", () => {
  // Il confine è incluso: chi finisce alle 12 in punto consegna nella fascia
  // delle 12. Escluderlo sposterebbe un sacco che non ne aveva bisogno.
  const r = scegliRiconsegna(VENERDI_12, f("ven12", VENERDI_12), [], []);
  assert.equal(r.esito, "resta");
});

test("pronto dopo, e il cliente ha una consegna vicina in calendario: si accoda", () => {
  const r = scegliRiconsegna(
    "2026-09-06T10:00:00+00:00",
    f("ven12", VENERDI_12),
    [f("mer9", MERCOLEDI_9)],
    [f("ven11", VENERDI_11)],
  );
  assert.deepEqual(r, { esito: "spostata", slotId: "mer9" });
});

test("il caso Giulia: consegna in calendario a due settimane, fascia libera fra tre giorni → vince la fascia", () => {
  // Applicare «si passa alla prossima consegna schedulata» alla lettera le
  // terrebbe il bucato dal 5 al 18 settembre per una macchia.
  const r = scegliRiconsegna(
    "2026-09-05T10:00:00+00:00",
    f("ven12", VENERDI_12),
    [f("18sett", GIOVEDI_18_SETT)],
    [f("mer9", MERCOLEDI_9), f("ven11", VENERDI_11)],
  );
  assert.deepEqual(r, { esito: "spostata", slotId: "mer9" });
});

test("nessuna consegna in calendario (il caso fabia): prima fascia libera utile", () => {
  const r = scegliRiconsegna("2026-09-05T10:00:00+00:00", f("ven12", VENERDI_12), [], [
    f("ven11", VENERDI_11),
    f("mer9", MERCOLEDI_9),
  ]);
  assert.deepEqual(r, { esito: "spostata", slotId: "mer9" }, "deve scegliere la più vicina, non la prima della lista");
});

test("le fasce già passate rispetto al pronto non si scelgono mai", () => {
  const r = scegliRiconsegna("2026-09-10T10:00:00+00:00", f("ven12", VENERDI_12), [f("mer9", MERCOLEDI_9)], [
    f("ven4", VENERDI_18),
  ]);
  assert.deepEqual(r, { esito: "nessuna_fascia", slotId: null });
});

test("niente fasce e niente calendario: non si inventa una data", () => {
  const r = scegliRiconsegna("2026-09-05T10:00:00+00:00", f("ven12", VENERDI_12), [], []);
  assert.deepEqual(r, { esito: "nessuna_fascia", slotId: null });
});

test("ordine senza riconsegna prenotata: si sceglie comunque la prima utile", () => {
  const r = scegliRiconsegna("2026-09-05T10:00:00+00:00", null, [], [f("mer9", MERCOLEDI_9)]);
  assert.deepEqual(r, { esito: "spostata", slotId: "mer9" });
});

test("il tetto per accodare è proprio ACCORPA_ENTRO_GIORNI", () => {
  const pronto = "2026-09-05T10:00:00+00:00";
  const dentro = new Date(Date.parse(pronto) + ACCORPA_ENTRO_GIORNI * 86_400_000).toISOString();
  const fuori = new Date(Date.parse(pronto) + (ACCORPA_ENTRO_GIORNI * 86_400_000 + 60_000)).toISOString();

  assert.equal(
    scegliRiconsegna(pronto, null, [f("cal", dentro)], [f("libera", VENERDI_11)]).slotId,
    "cal",
    "al limite esatto si accoda ancora",
  );
  assert.equal(
    scegliRiconsegna(pronto, null, [f("cal", fuori)], [f("libera", VENERDI_11)]).slotId,
    "libera",
    "un minuto oltre il limite si preferisce una fascia nuova",
  );
});

test("formati di data diversi si confrontano come istanti, non come testo", () => {
  // PostgREST scrive `+00:00`, toISOString() scrive `Z`: confrontarli come
  // stringhe ha già prodotto un guasto una volta in questo progetto.
  const r = scegliRiconsegna("2026-09-04T09:00:00.000Z", f("ven12", "2026-09-04T10:00:00+00:00"), [], []);
  assert.equal(r.esito, "resta", "pronto un'ora prima della fascia: regge");
});

test("nuovaEta non accorcia mai la scadenza dell'ordine", () => {
  assert.equal(nuovaEta("2026-09-03T07:00:00+00:00", "2026-09-05T07:00:00+00:00"), "2026-09-05T07:00:00+00:00");
  assert.equal(nuovaEta("2026-09-05T07:00:00+00:00", "2026-09-03T07:00:00+00:00"), "2026-09-05T07:00:00+00:00");
  assert.equal(nuovaEta(null, "2026-09-03T07:00:00+00:00"), "2026-09-03T07:00:00+00:00");
});
