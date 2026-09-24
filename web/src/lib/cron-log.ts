import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { registraGuasto } from "@/lib/incidenti";

/** Esegue un lavoro programmato lasciandone traccia, sempre.
 *
 *  Il punto non è il caso che fallisce — quello già finiva nel registro dei
 *  guasti. Il punto è il caso che **riesce senza fare niente**, che finora era
 *  indistinguibile dal caso che non è mai partito: entrambi silenzio.
 *
 *  Scrive la riga anche quando il lavoro esplode, e la scrittura non può far
 *  fallire il lavoro: un registro che fa cadere ciò che dovrebbe sorvegliare è
 *  peggio di nessun registro. */
export async function eseguiCron<T>(
  job: string,
  fn: () => Promise<T>,
  /** Come si racconta l'esito in una riga. Ometterlo scrive «fatto». */
  riassumi?: (esito: T) => string,
): Promise<{ ok: true; esito: T } | { ok: false; errore: string }> {
  const inizio = new Date().toISOString();
  try {
    const esito = await fn();
    await scrivi({
      job,
      started_at: inizio,
      finished_at: new Date().toISOString(),
      ok: true,
      riassunto: (riassumi ? riassumi(esito) : "fatto").slice(0, 300),
      errore: null,
    });
    return { ok: true, esito };
  } catch (err) {
    const errore = err instanceof Error ? err.message : String(err);
    await scrivi({
      job,
      started_at: inizio,
      finished_at: new Date().toISOString(),
      ok: false,
      riassunto: null,
      errore: errore.slice(0, 500),
    });
    // Il registro dei guasti resta: è quello che finisce nel riepilogo del
    // mattino, e un cron morto va detto lì e non solo in una tabella che
    // qualcuno deve pensare di aprire.
    await registraGuasto("cron", `Cron ${job} fallito: ${errore}`, { job });
    return { ok: false, errore };
  }
}

async function scrivi(riga: {
  job: string;
  started_at: string;
  finished_at: string;
  ok: boolean;
  riassunto: string | null;
  errore: string | null;
}): Promise<void> {
  try {
    await createServiceClient().from("cron_runs").insert(riga);
  } catch (err) {
    // Non si rilancia e non si registra un guasto: se anche il registro delle
    // esecuzioni è irraggiungibile, il problema è a monte e lo dirà qualcun
    // altro. Qui si evita solo di far cadere il lavoro vero.
    console.error(`[cron-log] esecuzione di ${riga.job} non registrata:`, err);
  }
}
