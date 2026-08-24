import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { renderEmail, sendMail } from "@/lib/email";
import { sendPush } from "@/lib/push";
import { testoSollecito, ULTIMO_SOLLECITO, linkPagamento } from "@/lib/dunning-piano";

/** Il recupero di un pagamento fallito: un solo posto dove si decide che cosa
 *  parte e che cosa si scrive in banca dati.
 *
 *  Prima esisteva solo un'email, spedita dal webhook e mai più: nessuna traccia
 *  di quando era partita, quindi nessun secondo tentativo possibile, e il link
 *  portava alla pagina abbonamento — che per chi è in `past_due` mostra la
 *  lista dei piani come a un nuovo iscritto, senza mai offrire di saldare la
 *  fattura rimasta aperta. Qui si tiene l'URL di quella fattura, che paga in un
 *  tap, e il contatore dei solleciti già mandati. */

type Destinatario = {
  userId: string | null;
  email: string | null;
  nome: string | null;
};

/** Manda il sollecito numero `step` e registra che è partito.
 *  Best-effort come tutte le notifiche: non lancia mai, perché un problema con
 *  SMTP non deve far ritentare a Stripe un webhook già andato a buon fine. */
export async function inviaSollecito(opts: {
  subscriptionId: string;
  step: number;
  invoiceUrl?: string | null;
  destinatario: Destinatario;
}): Promise<{ inviato: boolean; motivo?: string }> {
  const { subscriptionId, step, invoiceUrl, destinatario } = opts;
  const db = createServiceClient();
  const nome = destinatario.nome?.split(" ")[0] ?? "";
  const testo = testoSollecito(step, nome);
  const href = linkPagamento(invoiceUrl);

  try {
    if (destinatario.email) {
      await sendMail({
        to: destinatario.email,
        subject: testo.subject,
        html: renderEmail({
          title: testo.title,
          emoji: "💳",
          preheader: "Salda la fattura aperta per riattivare i ritiri.",
          body: testo.body,
          cta: { label: invoiceUrl ? "Paga ora" : "Aggiorna pagamento", href },
          footerNote:
            step >= ULTIMO_SOLLECITO
              ? "Questo è l'ultimo avviso automatico: dopo non ti scriviamo più."
              : undefined,
        }),
      });
    }
    if (destinatario.userId) {
      await sendPush(destinatario.userId, {
        title: "WashLoop · pagamento",
        body: testo.push,
        url: "/app/abbonamento",
      });
    }
  } catch (err) {
    console.error(`[dunning] sollecito ${step} non spedito:`, err);
    // Si segna comunque: se l'email è rimbalzata, riprovare domani con lo stesso
    // testo non cambia l'esito e intanto blocca il resto del calendario.
  }

  const { error } = await db
    .from("subscriptions")
    .update({ dunning_step: step, dunning_last_sent_at: new Date().toISOString() })
    .eq("id", subscriptionId);
  if (error) return { inviato: false, motivo: error.message };
  return { inviato: true };
}

/** Il pagamento è arrivato: si chiude il recupero e si cancella la fattura
 *  aperta, così il banner in app sparisce e il cron smette di scrivere. */
export async function chiudiRecupero(stripeCustomerId: string) {
  const db = createServiceClient();
  await db
    .from("subscriptions")
    .update({
      dunning_step: 0,
      dunning_last_sent_at: null,
      last_failed_invoice_url: null,
      last_failed_at: null,
    })
    .eq("stripe_customer_id", stripeCustomerId)
    .gt("dunning_step", 0);
}
