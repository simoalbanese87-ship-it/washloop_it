import { NextResponse } from "next/server";
import { eseguiCron } from "@/lib/cron-log";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/email";
import { fineAbbonamentoEmailHtml } from "@/lib/email-templates";
import { vaAvvisato, type RigaFine } from "@/lib/fine-abbonamento";
import { siteUrl } from "@/lib/stripe";
import { fmtDate } from "@/lib/format";

/** Cron giornaliero: «la tua prova finisce fra due giorni».
 *
 *  Un abbonamento a termine si chiude da solo, ed è il suo pregio. Ma se il
 *  cliente lo scopre dal servizio che smette di esserci, il pregio diventa un
 *  reclamo. Stripe non ci aiuta: `customer.subscription.trial_will_end` esiste
 *  solo per le prove gratuite, e per una prova a pagamento non c'è nessun
 *  evento equivalente. Quindi ce lo guardiamo noi, una volta al giorno.
 *
 *  Chi avvisare lo decide `vaAvvisato` in `fine-abbonamento.ts`, che è
 *  collaudato: qui c'è solo il giro sui clienti e l'invio.
 *
 *  Come il dunning, e a differenza dei cron che non mandano email: senza
 *  `CRON_SECRET` risponde 401 e basta. Un endpoint che manda posta vera ai
 *  clienti non può restare aperto perché una variabile non è impostata. */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Riga = RigaFine & { id: string; user_id: string };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const r = await eseguiCron(
    "fine-abbonamento",
    async () => {
      const db = createServiceClient();
      const { data: righe, error } = await db
        .from("subscriptions")
        .select("id, user_id, status, termina_dopo_settimane, cancel_at_period_end, current_period_end, fine_avviso_inviato_at")
        .not("termina_dopo_settimane", "is", null)
        .eq("status", "active")
        .is("fine_avviso_inviato_at", null)
        .returns<Riga[]>();
      if (error) throw new Error(error.message);

      const adesso = Date.now();
      const daAvvisare = (righe ?? []).filter((riga) => vaAvvisato(riga, adesso));

      let inviate = 0;
      for (const riga of daAvvisare) {
        // Nome ed email stanno in due posti: il nome in `profiles`, l'email in
        // `auth.users`. Sono pochi per definizione.
        const [{ data: prof }, { data: utente }] = await Promise.all([
          db.from("profiles").select("full_name").eq("id", riga.user_id).maybeSingle<{ full_name: string | null }>(),
          db.auth.admin.getUserById(riga.user_id),
        ]);
        const to = utente?.user?.email;
        if (!to) {
          console.error(`[cron/fine-abbonamento] nessuna email per ${riga.user_id}`);
          continue;
        }

        await sendMail({
          to,
          subject: "La tua prova WashLoop sta per finire",
          html: fineAbbonamentoEmailHtml({
            fullName: prof?.full_name ?? null,
            // La data vera, non «fra due giorni»: se il periodo si sposta,
            // quella frase diventa falsa e nessuno se ne accorge.
            quando: fmtDate(riga.current_period_end as string),
            settimane: riga.termina_dopo_settimane as number,
            siteUrl: siteUrl(),
          }),
        });
        // Si marca **dopo** l'invio: se la mail fallisce, il cron di domani
        // riprova invece di dare per avvisato chi non ha ricevuto niente.
        await db
          .from("subscriptions")
          .update({ fine_avviso_inviato_at: new Date().toISOString() })
          .eq("id", riga.id);
        inviate++;
      }
      return { aTermine: righe?.length ?? 0, inviate };
    },
    (e) => (e.inviate === 0 ? `nessuna prova in scadenza (${e.aTermine} a termine)` : `${e.inviate} avvisi di fine inviati`),
  );

  return r.ok
    ? NextResponse.json({ ok: true, ...r.esito })
    : NextResponse.json({ ok: false, error: r.errore }, { status: 500 });
}
