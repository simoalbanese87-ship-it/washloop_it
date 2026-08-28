import { NextResponse } from "next/server";
import { importaLeadFunnel } from "@/lib/funnel-import";
import { registraGuasto } from "@/lib/incidenti";

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

  const esito = await importaLeadFunnel();
  if (!esito.ok) {
    console.error("[cron/funnel-import] fallito:", esito.errore);
    await registraGuasto("cron", `Cron funnel-import fallito: ${esito.errore ?? "errore"}`);
    return NextResponse.json({ ok: false, error: esito.errore }, { status: 500 });
  }
  return NextResponse.json(esito);
}
