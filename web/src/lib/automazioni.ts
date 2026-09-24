import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { statoAutomazioni, type StatoJob, type UltimoGiro } from "@/lib/cron-stato";

/** Lo stato delle automazioni per il pannello: l'ultimo giro di ciascuna.
 *
 *  Una sola query per tutte: le righe recenti bastano, perché quello che
 *  interessa è l'ultima di ogni lavoro e i lavori sono cinque. La regola su
 *  cosa sia «in ritardo» sta in `cron-stato.ts`, che è puro e ha i test. */
export async function statoDelleAutomazioni(): Promise<StatoJob[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("cron_runs")
    .select("job, started_at, ok, riassunto, errore")
    .order("started_at", { ascending: false })
    .limit(200)
    .returns<UltimoGiro[]>();
  return statoAutomazioni(data ?? []);
}
