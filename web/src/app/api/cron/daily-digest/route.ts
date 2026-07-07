import { NextResponse } from "next/server";
import { sendDailyDigest } from "@/lib/digest";

/** Cron giornaliero: invia agli admin il riepilogo dei nuovi clienti e lead
 *  delle ultime 24 ore. Non invia nulla se non ci sono novità. */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await sendDailyDigest(24);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron/daily-digest] errore:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "errore" }, { status: 500 });
  }
}
