import { NextResponse } from "next/server";
import { registraGuasto } from "@/lib/incidenti";
import { createServiceClient } from "@/lib/supabase/server";
import { prossimoSollecito } from "@/lib/dunning-piano";
import { inviaSollecito } from "@/lib/dunning";

/** Cron giornaliero: i solleciti dopo il primo.
 *
 *  Il primo lo manda il webhook nel momento in cui la carta viene rifiutata.
 *  Da lì in poi serve qualcuno che torni a guardare: il secondo dopo tre
 *  giorni, il terzo dopo una settimana, e poi basta. Il calendario sta in
 *  `dunning-piano.ts`, che è collaudato: qui c'è solo il giro sui clienti.
 *
 *  A differenza degli altri cron, senza `CRON_SECRET` questo risponde 401 e
 *  basta. Gli altri usano `if (secret && ...)`, che con la variabile non
 *  impostata lascia l'endpoint aperto a chiunque: qui non è accettabile,
 *  perché una chiamata ripetuta manderebbe email vere ai clienti. */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Riga = {
  id: string;
  user_id: string;
  status: string;
  dunning_step: number | null;
  dunning_last_sent_at: string | null;
  last_failed_invoice_url: string | null;
};

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = createServiceClient();
    const { data: righe, error } = await db
      .from("subscriptions")
      .select("id, user_id, status, dunning_step, dunning_last_sent_at, last_failed_invoice_url")
      .in("status", ["past_due", "unpaid"])
      .gt("dunning_step", 0)
      .returns<Riga[]>();
    if (error) throw new Error(error.message);

    const adesso = Date.now();
    // Solo chi è davvero in scadenza di sollecito: il resto non si tocca.
    const daSollecitare = (righe ?? [])
      .map((r) => ({ riga: r, step: prossimoSollecito(r, adesso) }))
      .filter((x): x is { riga: Riga; step: number } => x.step !== null);

    let inviati = 0;
    for (const { riga, step } of daSollecitare) {
      // Nome ed email non stanno insieme: il nome è in `profiles`, l'email in
      // `auth.users`. Una coppia di letture per cliente, ma sono pochi per
      // definizione — se diventassero tanti, il problema non è questo cron.
      const [{ data: prof }, { data: utente }] = await Promise.all([
        db.from("profiles").select("full_name").eq("id", riga.user_id).maybeSingle<{ full_name: string | null }>(),
        db.auth.admin.getUserById(riga.user_id),
      ]);

      const esito = await inviaSollecito({
        subscriptionId: riga.id,
        step,
        invoiceUrl: riga.last_failed_invoice_url,
        destinatario: {
          userId: riga.user_id,
          email: utente?.user?.email ?? null,
          nome: prof?.full_name ?? null,
        },
      });
      if (esito.inviato) inviati++;
      else console.error(`[cron/dunning] sollecito ${step} non registrato per ${riga.id}: ${esito.motivo}`);
    }

    return NextResponse.json({ ok: true, inRecupero: righe?.length ?? 0, inviati });
  } catch (e) {
    console.error("[cron/dunning] errore:", e);
    await registraGuasto("cron", `Cron dunning fallito: ${e instanceof Error ? e.message : "errore"}`);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "errore" }, { status: 500 });
  }
}
