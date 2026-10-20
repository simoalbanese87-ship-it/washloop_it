import { test } from "node:test";
import assert from "node:assert/strict";
import {
  conteggiaCapo,
  quantoPagaLaLavanderia,
  ridistribuisciCanone,
  canoneUsateDaRighe,
  periodoDelCanone,
  fraseCapiCompresi,
} from "./capi-compresi.ts";

test("Savino: sei maglie, quattro comprese nel canone", () => {
  const c = conteggiaCapo({ trovate: 6, inclusePerSacco: 0, sacchi: 1, canoneSpettanti: 4 });
  assert.equal(c.daAddebitare, 2);
  assert.equal(c.incluseCanone, 4);
  assert.equal(c.incluseSacco, 0);
  // Alla lavanderia si pagano tutte e sei: il lavoro è stato fatto.
  assert.equal(c.daPagare, 6);
  assert.equal(c.canoneResiduoDopo, 0);
});

test("sei maglie su due ritiri dello stesso ciclo: il diritto si consuma una volta sola", () => {
  const primo = conteggiaCapo({ trovate: 3, inclusePerSacco: 0, sacchi: 1, canoneSpettanti: 4, canoneGiaUsate: 0 });
  assert.equal(primo.daAddebitare, 0);
  assert.equal(primo.incluseCanone, 3);

  const secondo = conteggiaCapo({ trovate: 3, inclusePerSacco: 0, sacchi: 1, canoneSpettanti: 4, canoneGiaUsate: 3 });
  assert.equal(secondo.daAddebitare, 2);
  assert.equal(secondo.incluseCanone, 1);
  assert.equal(secondo.canoneResiduoDopo, 0);
});

test("le due franchigie insieme: prima il sacco, poi il canone", () => {
  // Sei camicie, un sacco che ne comprende tre, il canone ne comprende due.
  const c = conteggiaCapo({ trovate: 6, inclusePerSacco: 3, sacchi: 1, canoneSpettanti: 2 });
  assert.equal(c.incluseSacco, 3);
  assert.equal(c.incluseCanone, 2);
  assert.equal(c.daAddebitare, 1);
  // Tre e non sei: le comprese nel sacco stanno già nel compenso del sacco.
  assert.equal(c.daPagare, 3);
});

test("l'ordine di consumo cambia quanto paghiamo noi, non quanto paga il cliente", () => {
  const c = conteggiaCapo({ trovate: 3, inclusePerSacco: 3, sacchi: 1, canoneSpettanti: 3 });
  assert.equal(c.daAddebitare, 0, "il cliente non paga niente in entrambi i casi");
  assert.equal(c.incluseSacco, 3);
  assert.equal(c.incluseCanone, 0);
  // Se il canone fosse consumato per primo, qui pagheremmo 3 unità.
  assert.equal(c.daPagare, 0);
  assert.equal(c.canoneResiduoDopo, 3, "il diritto del mese resta intatto");
});

test("senza abbonamento non c'è niente di compreso", () => {
  // `inclusePerSacco` arriva già azzerato da `franchigiaPerSacco`, e un cliente
  // a consumo non ha capi compresi nel canone perché non ha un canone.
  const c = conteggiaCapo({ trovate: 4, inclusePerSacco: 0, sacchi: 1, canoneSpettanti: null });
  assert.equal(c.daAddebitare, 4);
  assert.equal(c.daPagare, 4);
});

test("due registrazioni sullo stesso ordine non usano la franchigia due volte", () => {
  const c = conteggiaCapo({
    trovate: 2,
    inclusePerSacco: 3,
    sacchi: 1,
    giaConteggiateSullOrdine: 3,
    canoneSpettanti: 1,
    canoneGiaUsate: 0,
  });
  assert.equal(c.incluseSacco, 0, "la franchigia del sacco è già stata usata tutta");
  assert.equal(c.incluseCanone, 1);
  assert.equal(c.daAddebitare, 1);
});

test("più trovate del diritto: il residuo non va sotto zero", () => {
  const c = conteggiaCapo({ trovate: 1, inclusePerSacco: 0, sacchi: 1, canoneSpettanti: 1, canoneGiaUsate: 5 });
  assert.equal(c.canoneResiduoPrima, 0);
  assert.equal(c.incluseCanone, 0);
  assert.equal(c.daAddebitare, 1);
});

test("numeri storti non producono addebiti storti", () => {
  const c = conteggiaCapo({ trovate: -3, inclusePerSacco: 3, sacchi: 1, canoneSpettanti: 0 });
  assert.equal(c.daAddebitare, 0);
  assert.equal(c.daPagare, 0);
  const d = conteggiaCapo({ trovate: 2, inclusePerSacco: NaN, sacchi: 1, canoneSpettanti: NaN });
  assert.equal(d.daAddebitare, 2);
});

test("quanto si paga alla lavanderia: addebitate più comprese nel canone", () => {
  assert.equal(quantoPagaLaLavanderia({ qty: 0, qty_inclusa_canone: 4 }), 4);
  assert.equal(quantoPagaLaLavanderia({ qty: 2, qty_inclusa_canone: 4 }), 6);
  // Le comprese nel sacco non compaiono qui: non si pagano a parte.
  assert.equal(quantoPagaLaLavanderia({ qty: 0 }), 0);
});

test("la ridistribuzione copre in ordine di registrazione", () => {
  const r = ridistribuisciCanone(
    [
      { id: "a", daCoprire: 2 },
      { id: "b", daCoprire: 3 },
      { id: "c", daCoprire: 1 },
    ],
    4,
  );
  assert.deepEqual(r, [
    { id: "a", incluseCanone: 2 },
    { id: "b", incluseCanone: 2 },
    { id: "c", incluseCanone: 0 },
  ]);
});

test("un capo annullato libera il diritto, uno rimborsato no", () => {
  assert.equal(
    canoneUsateDaRighe([
      { qty_inclusa_canone: 2 },
      { qty_inclusa_canone: 1, annullato_at: "2026-10-20T10:00:00Z" },
      { qty_inclusa_canone: 1 },
    ]),
    3,
  );
});

test("il periodo viene dal rinnovo quando c'è, e lo dice", () => {
  const p = periodoDelCanone({ current_period_end: "2026-11-14T18:01:26Z" }, new Date("2026-10-20T08:00:00Z"));
  assert.equal(p.fonte, "rinnovo");
  assert.equal(p.dalIso.slice(0, 10), "2026-10-14");
  assert.equal(p.alIso.slice(0, 10), "2026-11-14");
});

test("i mesi corti non spostano il ciclo", () => {
  const p = periodoDelCanone({ current_period_end: "2026-03-31T10:00:00Z" }, new Date("2026-03-15T08:00:00Z"));
  assert.equal(p.dalIso.slice(0, 10), "2026-02-28");
});

test("senza rinnovo si usa il giorno di attivazione, e si dichiara", () => {
  const p = periodoDelCanone(
    { current_period_end: null, activated_at: "2026-06-12T09:00:00Z" },
    new Date("2026-10-20T08:00:00Z"),
  );
  assert.equal(p.fonte, "attivazione");
  assert.equal(p.dalIso.slice(0, 10), "2026-10-12");
  assert.equal(p.alIso.slice(0, 10), "2026-11-12");
  // Il periodo deve contenere oggi, o conterebbe gli ordini sbagliati.
  assert.ok(p.dalIso <= "2026-10-20T08:00:00.000Z" && p.alIso > "2026-10-20T08:00:00.000Z");
});

test("il giorno di attivazione più avanti nel mese riporta al ciclo precedente", () => {
  const p = periodoDelCanone(
    { current_period_end: null, activated_at: "2026-06-28T09:00:00Z" },
    new Date("2026-10-05T08:00:00Z"),
  );
  assert.equal(p.dalIso.slice(0, 10), "2026-09-28");
  assert.equal(p.alIso.slice(0, 10), "2026-10-28");
});

test("senza niente resta il mese solare, detto com'è", () => {
  const p = periodoDelCanone({}, new Date("2026-10-20T08:00:00Z"));
  assert.equal(p.fonte, "mese");
  assert.equal(p.dalIso.slice(0, 10), "2026-10-01");
  assert.equal(p.alIso.slice(0, 10), "2026-11-01");
});

test("il saldo si dice in italiano, e a chi non ha diritti non si dice niente", () => {
  assert.equal(fraseCapiCompresi([]), null);
  assert.equal(
    fraseCapiCompresi([{ nome: "Maglia", spettanti: 4, usate: 4 }], "2026-11-14T18:00:00Z"),
    "Maglia: usate tutte (4 di 4) · si azzerano il 14/11",
  );
  assert.equal(
    fraseCapiCompresi([{ nome: "Maglia", spettanti: 4, usate: 3 }]),
    "Maglia: 3 di 4, ne resta 1",
  );
});
