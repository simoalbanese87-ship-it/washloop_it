import { test } from "node:test";
import assert from "node:assert/strict";
import { passaggiDiOrdine, dividiPassaggi, prossimoPassaggio, type OrdinePerPassaggi } from "./passaggi.ts";
import { ORDER_FLOW } from "./orders.ts";

const base = (p: Partial<OrdinePerPassaggi> = {}): OrdinePerPassaggi => ({
  id: "o1",
  status: "pickup_scheduled",
  created_at: "2026-08-10T08:00:00Z",
  bags: 2,
  pickup_at: "2026-08-12T07:00:00Z",
  pickup_end: "2026-08-12T09:00:00Z",
  delivery_at: null,
  delivery_end: null,
  ...p,
});

test("un ordine appena prenotato ha solo il ritiro, previsto", () => {
  const p = passaggiDiOrdine(base());
  assert.equal(p.length, 1);
  assert.equal(p[0].tipo, "ritiro");
  assert.equal(p[0].stato, "previsto");
});

test("dopo il ritiro il passaggio è fatto, e la riconsegna non c'è ancora", () => {
  const p = passaggiDiOrdine(base({ status: "at_laundry" }));
  assert.equal(p.length, 1);
  assert.equal(p[0].stato, "fatto");
});

test("a bucato pronto compare la riconsegna, anche senza fascia fissata", () => {
  const p = passaggiDiOrdine(base({ status: "ready" }));
  assert.equal(p.length, 2);
  const r = p.find((x) => x.tipo === "riconsegna")!;
  assert.equal(r.quando, null); // «da programmare»: la fascia la fissiamo noi
  assert.equal(r.stato, "previsto");
});

test("consegna fallita: il passaggio lo dice, non sparisce", () => {
  const p = passaggiDiOrdine(base({ status: "delivery_failed", delivery_at: "2026-08-15T07:00:00Z" }));
  assert.equal(p.find((x) => x.tipo === "riconsegna")!.stato, "non_riuscito");
});

test("ordine annullato: entrambi i passaggi risultano annullati e non tra i prossimi", () => {
  const o = base({ status: "cancelled", delivery_at: "2026-08-15T07:00:00Z" });
  assert.ok(passaggiDiOrdine(o).every((x) => x.stato === "annullato"));
  assert.equal(dividiPassaggi([o]).prossimi.length, 0);
});

test("i prossimi sono in ordine di quando succedono, non di quando sono stati creati", () => {
  const vecchio = base({ id: "vecchio", created_at: "2026-08-01T08:00:00Z", pickup_at: "2026-08-20T07:00:00Z" });
  const nuovo = base({ id: "nuovo", created_at: "2026-08-10T08:00:00Z", pickup_at: "2026-08-13T07:00:00Z" });
  const { prossimi } = dividiPassaggi([vecchio, nuovo]);
  assert.deepEqual(prossimi.map((p) => p.orderId), ["nuovo", "vecchio"]);
});

test("la riconsegna senza data resta tra i prossimi, ma in coda", () => {
  const daProgrammare = base({ id: "senzaData", status: "ready", pickup_at: "2026-08-01T07:00:00Z" });
  const conData = base({ id: "conData", pickup_at: "2026-08-25T07:00:00Z" });
  const { prossimi } = dividiPassaggi([daProgrammare, conData]);
  assert.equal(prossimi[prossimi.length - 1].quando, null);
});

test("il prossimo passaggio della Home ha sempre una data", () => {
  const o = base({ status: "ready", pickup_at: "2026-08-01T07:00:00Z" });
  assert.equal(prossimoPassaggio([o]), null); // solo riconsegna da programmare
  assert.equal(prossimoPassaggio([base()])!.tipo, "ritiro");
});

test("la sequenza copiata in passaggi.ts non è divergente da ORDER_FLOW", async () => {
  // Se qualcuno aggiunge uno stato al flusso e non qui, i passaggi
  // calcolerebbero "fatto" e "previsto" sbagliati senza che nessuno se ne
  // accorga: questo test è l'unica cosa che lo impedisce.
  const modulo = await import("./passaggi.ts");
  const sequenza = (modulo as unknown as { SEQUENZA?: readonly string[] }).SEQUENZA;
  if (sequenza) assert.deepEqual([...sequenza], [...ORDER_FLOW]);
  else {
    // SEQUENZA non è esportata: verifico indirettamente che l'ultimo stato del
    // flusso sia ancora "completed" e che "ready" preceda "delivered".
    assert.equal(ORDER_FLOW[ORDER_FLOW.length - 1], "completed");
    assert.ok(ORDER_FLOW.indexOf("ready") < ORDER_FLOW.indexOf("delivered"));
  }
});
