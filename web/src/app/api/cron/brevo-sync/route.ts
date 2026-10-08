import { NextResponse } from "next/server";
import { sincronizzaTuttiIContatti, riassuntoSync } from "@/lib/brevo-sync";
import { eseguiCron } from "@/lib/cron-log";

/** Cron notturno: riallinea le liste di Brevo a quello che dice il database.
 *
 *  Gli spostamenti veri avvengono già nel momento in cui succede il fatto —
 *  account aperto, abbonamento attivo, disiscrizione, tipo di servizio
 *  cambiato. Questo serve per il resto: un abbonamento scaduto che nessuno ha
 *  toccato, una correzione fatta a mano sul database, una chiamata a Brevo
 *  fallita ieri notte. Senza, le liste divergono di poco ogni giorno e nessuno
 *  se ne accorge finché non parte l'email sbagliata alla persona sbagliata.
 *
 *  `?dry=1` dice cosa farebbe senza toccare niente: è il modo in cui va
 *  guardato la prima volta, perché una lista sbagliata non si disfa — le email
 *  partono e basta.
 *
 *  La chiave di Brevo manca? Non fa niente e lo scrive nel registro: è la
 *  stessa regola degli altri ponti verso l'esterno. */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const limite = parseInt(url.searchParams.get("limite") ?? "", 10);

  const r = await eseguiCron(
    "brevo-sync",
    () => sincronizzaTuttiIContatti({ dry, limite: Number.isFinite(limite) ? limite : undefined }),
    riassuntoSync,
  );

  return r.ok
    ? NextResponse.json(r.esito)
    : NextResponse.json({ ok: false, error: r.errore }, { status: 500 });
}
