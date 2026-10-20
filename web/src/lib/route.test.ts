import { test } from "node:test";
import assert from "node:assert/strict";
import { partenzaDelGiro, haversineKm, optimizeOrder, fuoriBlocco, type RouteStop } from "./route.ts";

const ZANICA = { lat: 45.641553, lng: 9.6794857 };   // la lavanderia
const DEPOSITO = { lat: 45.4370615, lng: 9.2029218 }; // Via Pizzi, Milano

test("se si comincia con una consegna si parte dalla lavanderia", () => {
  assert.deepEqual(partenzaDelGiro(true, ZANICA, DEPOSITO), ZANICA);
});

test("se si comincia con un ritiro si parte dal deposito", () => {
  assert.deepEqual(partenzaDelGiro(false, ZANICA, DEPOSITO), DEPOSITO);
});

test("senza indirizzo della lavanderia si ripiega sul deposito, non si resta senza partenza", () => {
  assert.deepEqual(partenzaDelGiro(true, null, DEPOSITO), DEPOSITO);
});

test("senza deposito si usa comunque la lavanderia", () => {
  assert.deepEqual(partenzaDelGiro(false, ZANICA, null), ZANICA);
});

test("senza né l'una né l'altro non si inventa un punto di partenza", () => {
  assert.equal(partenzaDelGiro(true, null, null), null);
});

test("la lavanderia è davvero fuori Milano: la scelta della partenza conta", () => {
  // Se fossero vicine la distinzione sarebbe accademica. Non lo è: da Zanica
  // la fermata più vicina di Milano è un'altra rispetto a quella dal deposito.
  const d = haversineKm(ZANICA.lat, ZANICA.lng, DEPOSITO.lat, DEPOSITO.lng);
  assert.ok(d > 35, `attesi oltre 35 km, trovati ${d.toFixed(1)}`);
});

// --- L'ordine di visita: fascia prima, giro poi, distanza per ultima --------

const DOMANI_9 = Date.parse("2026-10-20T07:00:00Z"); // 9:00 italiane
const DOMANI_13 = Date.parse("2026-10-20T11:00:00Z");

/** Quattro fermate a Milano, due per giro, messe a coppie **intrecciate**:
 *  andando solo per distanza si alternerebbero di continuo. */
const INTRECCIATE: RouteStop[] = [
  { lat: 45.470, lng: 9.150, deadlineMs: DOMANI_13, gruppo: "lavanderia" },
  { lat: 45.471, lng: 9.151, deadlineMs: DOMANI_13, gruppo: "stiro" },
  { lat: 45.472, lng: 9.152, deadlineMs: DOMANI_13, gruppo: "lavanderia" },
  { lat: 45.473, lng: 9.153, deadlineMs: DOMANI_13, gruppo: "stiro" },
];

test("a parità di fascia si finisce un giro prima di cominciare l'altro", () => {
  const ordine = optimizeOrder(DEPOSITO, INTRECCIATE);
  const gruppi = ordine.map((i) => INTRECCIATE[i].gruppo);
  // Un solo cambio di gruppo in tutto il giro: niente avanti e indietro.
  const cambi = gruppi.filter((g, i) => i > 0 && g !== gruppi[i - 1]).length;
  assert.equal(cambi, 1, `atteso un solo cambio di giro, trovati ${cambi}: ${gruppi.join(" → ")}`);
});

test("la fascia oraria batte il giro: non si resta sul proprio gruppo facendo tardi", () => {
  // La prima fermata è del giro «lavanderia» e scade tardi; la seconda è di un
  // altro giro ma scade alle 9. Deve passare quella, o il cliente delle 9 resta
  // ad aspettare perché avevamo deciso di finire il giro.
  const stops: RouteStop[] = [
    { lat: 45.470, lng: 9.150, deadlineMs: DOMANI_13, gruppo: "lavanderia" },
    { lat: 45.500, lng: 9.300, deadlineMs: DOMANI_9, gruppo: "stiro" },
    { lat: 45.4705, lng: 9.1505, deadlineMs: DOMANI_13, gruppo: "lavanderia" },
  ];
  const ordine = optimizeOrder(DEPOSITO, stops);
  assert.equal(ordine[0], 1, "la fermata delle 9 va servita per prima");
});

test("senza gruppi il comportamento è quello di sempre: la più vicina", () => {
  const stops: RouteStop[] = [
    { lat: 45.600, lng: 9.600, deadlineMs: null },
    { lat: 45.4375, lng: 9.2030, deadlineMs: null }, // a due passi dal deposito
  ];
  assert.deepEqual(optimizeOrder(DEPOSITO, stops), [1, 0]);
});

test("una fermata senza giro non trascina dietro le altre", () => {
  // `gruppo` assente vale `null`: fa gruppo a sé e non impedisce di proseguire.
  const stops: RouteStop[] = [
    { lat: 45.470, lng: 9.150, deadlineMs: null },
    { lat: 45.4701, lng: 9.1501, deadlineMs: null, gruppo: "stiro" },
    { lat: 45.4702, lng: 9.1502, deadlineMs: null, gruppo: "stiro" },
  ];
  const ordine = optimizeOrder(DEPOSITO, stops);
  assert.equal(ordine.length, 3);
  assert.deepEqual([...ordine].sort(), [0, 1, 2]);
});

// --- Le fasi: prima le riconsegne, poi i ritiri ----------------------------

/** Tre fermate vicine fra loro, stessa fascia larga: a decidere è la fase. */
const MISTE: RouteStop[] = [
  { lat: 45.470, lng: 9.150, deadlineMs: DOMANI_13, fase: 1 }, // ritiro
  { lat: 45.471, lng: 9.151, deadlineMs: DOMANI_13, fase: 0 }, // riconsegna
  { lat: 45.472, lng: 9.152, deadlineMs: DOMANI_13, fase: 1 }, // ritiro
];

test("a parità di fascia si consegna prima e si ritira dopo", () => {
  const ordine = optimizeOrder(DEPOSITO, MISTE);
  assert.equal(MISTE[ordine[0]].fase, 0, "la riconsegna va servita per prima");
  assert.deepEqual(ordine.slice(1).map((i) => MISTE[i].fase), [1, 1]);
});

test("un orario promesso scavalca il blocco: il cliente delle 9 non aspetta", () => {
  const stops: RouteStop[] = [
    { lat: 45.470, lng: 9.150, deadlineMs: DOMANI_13, fase: 0 }, // riconsegna, tardi
    { lat: 45.500, lng: 9.300, deadlineMs: DOMANI_9, fase: 1 },  // ritiro, alle 9
  ];
  const ordine = optimizeOrder(DEPOSITO, stops);
  assert.equal(ordine[0], 1, "la fascia viene prima della fase");
});

test("le fermate servite fuori dal loro blocco si riconoscono", () => {
  // Ordine di visita: ritiro, riconsegna, ritiro. Il primo è fuori blocco —
  // dopo di lui viene una riconsegna — gli altri due no.
  assert.deepEqual(fuoriBlocco([1, 0, 1]), [true, false, false]);
  // Un giro regolare non segnala niente.
  assert.deepEqual(fuoriBlocco([0, 0, 1, 1]), [false, false, false, false]);
  // Fasi non indicate: valgono zero e non segnalano niente.
  assert.deepEqual(fuoriBlocco([undefined, null]), [false, false]);
});

test("senza fasi il giro resta quello di prima", () => {
  const stops: RouteStop[] = [
    { lat: 45.600, lng: 9.600, deadlineMs: null },
    { lat: 45.4375, lng: 9.2030, deadlineMs: null },
  ];
  assert.deepEqual(optimizeOrder(DEPOSITO, stops), [1, 0]);
});

test("la fase viene prima del giro: non si ritira per restare sulla stessa lavanderia", () => {
  const stops: RouteStop[] = [
    { lat: 45.470, lng: 9.150, deadlineMs: DOMANI_13, fase: 0, gruppo: "stiro" },
    { lat: 45.4701, lng: 9.1501, deadlineMs: DOMANI_13, fase: 1, gruppo: "lavanderia" },
    { lat: 45.4702, lng: 9.1502, deadlineMs: DOMANI_13, fase: 0, gruppo: "lavanderia" },
  ];
  const ordine = optimizeOrder(DEPOSITO, stops);
  // Le due riconsegne prima, in qualunque giro siano; il ritiro per ultimo.
  assert.deepEqual(ordine.map((i) => stops[i].fase), [0, 0, 1]);
});
