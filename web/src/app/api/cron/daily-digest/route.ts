import { NextResponse } from "next/server";
import { sendDailyDigest } from "@/lib/digest";
import { eseguiCron } from "@/lib/cron-log";

/** Cron giornaliero: invia agli admin il riepilogo dei nuovi clienti e lead
 *  delle ultime 24 ore. Non invia nulla se non ci sono novità.
 *
 *  «Non ho inviato perché non c'era niente» è un esito, e da quando c'è
 *  `eseguiCron` viene scritto come gli altri: prima quel caso non lasciava
 *  traccia ed era indistinguibile dal cron che non era partito affatto. */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const r = await eseguiCron(
    "daily-digest",
    () => sendDailyDigest(24),
    (e) =>
      e.sent
        ? `inviato a ${e.recipients} ${e.recipients === 1 ? "admin" : "admin"}: ${e.customers} clienti, ${e.leads} lead`
        : `non inviato: ${e.reason ?? "nessuna novità"}`,
  );

  return r.ok
    ? NextResponse.json({ ok: true, ...r.esito })
    : NextResponse.json({ ok: false, error: r.errore }, { status: 500 });
}
