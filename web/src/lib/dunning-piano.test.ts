import { test } from "node:test";
import assert from "node:assert/strict";
import { prossimoSollecito, testoSollecito, ULTIMO_SOLLECITO } from "./dunning-piano.ts";

const ADESSO = new Date("2026-08-24T08:00:00Z").getTime();
const giorniFa = (n: number) => new Date(ADESSO - n * 24 * 3600 * 1000).toISOString();

test("chi non è in recupero non riceve niente", () => {
  assert.equal(prossimoSollecito({ dunning_step: 0, dunning_last_sent_at: null }, ADESSO), null);
  assert.equal(prossimoSollecito({ dunning_step: null, dunning_last_sent_at: null }, ADESSO), null);
});

test("il primo sollecito non lo manda il cron: lo manda il webhook al fallimento", () => {
  // step 0 = fallimento non ancora registrato. Se il cron partisse da qui,
  // manderebbe il primo avviso il giorno dopo invece che subito.
  assert.equal(prossimoSollecito({ dunning_step: 0, dunning_last_sent_at: giorniFa(10) }, ADESSO), null);
});

test("secondo sollecito dopo tre giorni, non prima", () => {
  const stato = { dunning_step: 1, dunning_last_sent_at: giorniFa(2) };
  assert.equal(prossimoSollecito(stato, ADESSO), null);
  assert.equal(prossimoSollecito({ dunning_step: 1, dunning_last_sent_at: giorniFa(3) }, ADESSO), 2);
  assert.equal(prossimoSollecito({ dunning_step: 1, dunning_last_sent_at: giorniFa(5) }, ADESSO), 2);
});

test("terzo sollecito quattro giorni dopo il secondo, cioè una settimana dal primo", () => {
  assert.equal(prossimoSollecito({ dunning_step: 2, dunning_last_sent_at: giorniFa(3) }, ADESSO), null);
  assert.equal(prossimoSollecito({ dunning_step: 2, dunning_last_sent_at: giorniFa(4) }, ADESSO), 3);
});

test("dopo il terzo non si scrive più, per quanto tempo passi", () => {
  assert.equal(prossimoSollecito({ dunning_step: 3, dunning_last_sent_at: giorniFa(30) }, ADESSO), null);
  assert.equal(prossimoSollecito({ dunning_step: 9, dunning_last_sent_at: giorniFa(90) }, ADESSO), null);
});

test("senza data dell'ultimo invio si aspetta: meglio tardi che due volte", () => {
  assert.equal(prossimoSollecito({ dunning_step: 1, dunning_last_sent_at: null }, ADESSO), null);
  assert.equal(prossimoSollecito({ dunning_step: 1, dunning_last_sent_at: "non-una-data" }, ADESSO), null);
});

test("un cron che salta dei giorni non manda i solleciti arretrati tutti insieme", () => {
  // Il cron non gira per due settimane. Al ritorno deve mandare UN sollecito,
  // il successivo, non recuperare quelli persi.
  assert.equal(prossimoSollecito({ dunning_step: 1, dunning_last_sent_at: giorniFa(14) }, ADESSO), 2);
});

test("ogni sollecito ha un testo diverso: tre volte lo stesso sembra un guasto", () => {
  const t1 = testoSollecito(1, "Emiliano");
  const t2 = testoSollecito(2, "Emiliano");
  const t3 = testoSollecito(ULTIMO_SOLLECITO, "Emiliano");
  const subjects = new Set([t1.subject, t2.subject, t3.subject]);
  assert.equal(subjects.size, 3);
  assert.ok(t1.title.includes("Emiliano"));
  assert.ok(t3.subject.toLowerCase().includes("ultimo"));
});

test("senza nome il testo resta corretto, senza virgola pendente", () => {
  const t = testoSollecito(1, "");
  assert.ok(!t.title.includes(","), `titolo con virgola sospesa: ${t.title}`);
});
