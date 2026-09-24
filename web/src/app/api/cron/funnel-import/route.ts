import { NextResponse } from "next/server";
import { importaLeadFunnel } from "@/lib/funnel-import";
import { eseguiCron } from "@/lib/cron-log";

/** Cron notturno: copia i lead del funnel dal Google Sheet dentro `leads`.
 *
 *  Serve a farli esistere davvero: finché stavano solo nel foglio erano un
 *  elenco in sola lettura, senza stato e senza conversione, e separato da
 *  quello della landing.
 *
 *  Rieseguibile senza danni: i lead già presenti non vengono duplicati e il
 *  lavoro fatto a mano (lo stato del contatto) non viene mai sovrascritto. */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const r = await eseguiCron(
    "funnel-import",
    async () => {
      const esito = await importaLeadFunnel();
      // Un import che risponde «non ok» è un guasto come un'eccezione: se non
      // si solleva qui, la riga nel registro direbbe che è andato bene.
      if (!esito.ok) throw new Error(esito.errore ?? "errore");
      return esito;
    },
    (e) => riassuntoImport(e),
  );

  return r.ok
    ? NextResponse.json(r.esito)
    : NextResponse.json({ ok: false, error: r.errore }, { status: 500 });
}

/** Una riga leggibile da mettere nel registro delle automazioni. */
function riassuntoImport(e: Record<string, unknown>): string {
  const n = (k: string) => (typeof e[k] === "number" ? (e[k] as number) : null);
  const nuovi = n("importati") ?? n("inseriti") ?? n("creati");
  const visti = n("letti") ?? n("totali") ?? n("righe");
  if (nuovi != null) return `${nuovi} nuovi${visti != null ? ` su ${visti} letti` : ""}`;
  return visti != null ? `${visti} righe lette` : "fatto";
}
