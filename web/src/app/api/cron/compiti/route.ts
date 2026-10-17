import { NextResponse } from "next/server";
import { eseguiCron } from "@/lib/cron-log";
import { allineaCompitiDiTutti, compitiDaFare } from "@/lib/compiti-sync";
import { sendPush } from "@/lib/push";

/** Il passaggio del mattino sui compiti del rider.
 *
 *  Fa due cose, e nessuna delle due è «creare i compiti»: quelli nascono dai
 *  cambi di abbonamento, nell'istante in cui succedono. Qui si rimedia a ciò
 *  che quell'istante ha perso.
 *
 *  1. **La rete.** Un webhook Stripe perso, un abbonamento toccato a mano dalla
 *     dashboard di Stripe, un profilo sistemato in pannello: in tutti questi
 *     casi il compito non è nato e nessuno se ne accorgerebbe, perché un
 *     promemoria che manca non dà errore. Ripassare tutti costa una query per
 *     cliente e ci sono otto clienti.
 *
 *  2. **Un avviso al giorno per rider**, non uno per compito. Tre notifiche di
 *     fila per tre cose della stessa giornata sono il modo in cui le notifiche
 *     smettono di essere lette — e poi non si legge più nemmeno quella che
 *     conta. Il conteggio basta: il dettaglio è nella sua app.
 *
 *  Gira alle 08:20 italiane (vercel.json è in UTC), cioè prima del giro. */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const r = await eseguiCron(
    "compiti",
    async () => {
      const allineati = await allineaCompitiDiTutti();

      // Solo quelli già visibili: un rientro programmato fra tre settimane non
      // è una cosa di oggi, e avvisarne adesso vorrebbe dire ripeterlo per
      // venti mattine di fila.
      const aperti = await compitiDaFare({ soloVisibili: true });

      const perRider = new Map<string, { dotazione: number; rientro: number }>();
      for (const c of aperti) {
        if (!c.assegnatoA) continue;
        const g = perRider.get(c.assegnatoA) ?? { dotazione: 0, rientro: 0 };
        g[c.tipo] += 1;
        perRider.set(c.assegnatoA, g);
      }

      for (const [riderId, g] of perRider) {
        const parti = [
          g.dotazione ? `${g.dotazione} da consegnare` : null,
          g.rientro ? `${g.rientro} da recuperare` : null,
        ].filter(Boolean);
        await sendPush(riderId, {
          title: "Materiale da caricare",
          body: `${parti.join(", ")}. Caricalo prima di partire.`,
          url: "/courier",
        });
      }

      return {
        ...allineati,
        aperti: aperti.length,
        senzaRider: aperti.filter((c) => !c.assegnatoA).length,
        avvisati: perRider.size,
      };
    },
    (e) =>
      `${e.clienti} clienti ripassati, ${e.creati} compiti nuovi, ${e.annullati} annullati; ${e.aperti} aperti oggi` +
      `${e.senzaRider ? ` (${e.senzaRider} senza rider)` : ""}, ${e.avvisati} rider avvisati`,
  );

  return r.ok
    ? NextResponse.json({ ok: true, ...r.esito })
    : NextResponse.json({ ok: false, error: r.errore }, { status: 500 });
}
