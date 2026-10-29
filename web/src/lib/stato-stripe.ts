import "server-only";
import { stripe, siteUrl } from "@/lib/stripe";
import { eventiNonAscoltati } from "@/lib/eventi-stripe";

/** Cosa dice Stripe di sé, chiesto a Stripe.
 *
 *  Perché esiste
 *  -------------
 *  Per giorni la diagnosi è stata: «la tabella `invoices` è vuota, quindi il
 *  webhook non arriva». È una deduzione, non un fatto — una tabella vuota ha
 *  molte cause e da fuori non si distinguono. Chi ha la risposta è Stripe, e le
 *  chiavi ce le ha il server: questa funzione gliele fa usare per rispondere
 *  alle due domande che contano davvero.
 *
 *  1. **Esiste un endpoint webhook che punta a noi, ed è acceso?** Se no, i
 *     pagamenti non entreranno mai nel sistema, per quanto il codice sia
 *     corretto — ed è la spiegazione più probabile di un registro incassi
 *     vuoto da sempre.
 *  2. **Quanto è stato incassato davvero?** Contando le fatture pagate, che è
 *     l'unico numero che nessun webbook mancato può falsare.
 */

export type StatoStripe =
  | { ok: false; errore: string }
  | {
      ok: true;
      /** Quanti endpoint webhook risultano configurati, in tutto. */
      endpoints: number;
      /** Quello che punta a questo sito, se c'è. */
      endpointNostro: {
        url: string;
        attivo: boolean;
        eventi: number;
        /** Gli eventi che il nostro gestore tratta ma Stripe non ci manda:
         *  codice che non verrà mai eseguito, e nessuno se ne accorge. */
        mancanti: string[];
      } | null;
      fatturePagate: number;
      incassatoCents: number;
    };

export async function statoStripe(giorni = 90): Promise<StatoStripe> {
  if (!process.env.STRIPE_SECRET_KEY) return { ok: false, errore: "STRIPE_SECRET_KEY non configurata" };

  try {
    const dal = Math.floor(Date.now() / 1000) - giorni * 86_400;
    const [hook, fatture] = await Promise.all([
      stripe().webhookEndpoints.list({ limit: 100 }),
      stripe().invoices.list({ status: "paid", created: { gte: dal }, limit: 100 }),
    ]);

    // Il confronto è sull'host, non sull'URL esatto: l'endpoint può essere
    // scritto con o senza `www`, con o senza barra finale.
    const host = (() => {
      try { return new URL(siteUrl()).host.replace(/^www\./, ""); } catch { return ""; }
    })();
    const nostro = hook.data.find((e) => {
      try { return new URL(e.url).host.replace(/^www\./, "") === host; } catch { return false; }
    });

    let incassatoCents = 0;
    let fatturePagate = 0;
    for (const f of fatture.data) {
      if ((f.amount_paid ?? 0) <= 0) continue;
      incassatoCents += f.amount_paid;
      fatturePagate++;
    }

    return {
      ok: true,
      endpoints: hook.data.length,
      endpointNostro: nostro
        ? {
            url: nostro.url,
            attivo: nostro.status === "enabled",
            eventi: nostro.enabled_events?.length ?? 0,
            mancanti: eventiNonAscoltati(nostro.enabled_events ?? []),
          }
        : null,
      fatturePagate,
      incassatoCents,
    };
  } catch (err) {
    return { ok: false, errore: err instanceof Error ? err.message : "errore sconosciuto" };
  }
}

/** Una riga del nostro registro che non dice la stessa cosa di Stripe. */
export type Divergenza = {
  userId: string;
  subId: string;
  nostro: string;
  stripe: string;
};

export type ConfrontoAbbonamenti =
  | { ok: false; errore: string }
  | { ok: true; controllati: number; divergenze: Divergenza[] };

/** Confronta la nostra copia degli abbonamenti con Stripe, uno per uno.
 *
 *  `subscriptions` si aggiorna quando arriva un webhook. Un messaggio perso,
 *  un evento non spuntato, una modifica fatta a mano sulla dashboard: la copia
 *  resta indietro e il pannello racconta con sicurezza una cosa che su Stripe
 *  non è più vera. Non c'era nessun posto da cui accorgersene — bisognava
 *  aprire una scheda alla volta e confrontare a occhio due riquadri distanti.
 *
 *  Si guardano solo gli abbonamenti **ancora vivi**: su uno chiuso sei mesi fa
 *  una differenza non cambia niente, e tenerli tutti vorrebbe dire una
 *  chiamata a Stripe per ognuno, per sempre. */
export async function confrontoAbbonamenti(
  righe: { user_id: string; stripe_subscription_id: string | null; status: string; cancel_at_period_end: boolean | null; cancel_at: string | null }[],
): Promise<ConfrontoAbbonamenti> {
  if (!process.env.STRIPE_SECRET_KEY) return { ok: false, errore: "STRIPE_SECRET_KEY non configurata" };
  const daControllare = righe.filter((r) => r.stripe_subscription_id);

  try {
    const divergenze: Divergenza[] = [];
    // Come si racconta uno stato, da tutte e due le parti con le stesse parole:
    // confrontare stringhe diverse farebbe segnalare differenze che non ci sono.
    const descrivi = (stato: string, disdetta: boolean) => `${stato}${disdetta ? " + disdetta programmata" : ""}`;

    for (const r of daControllare) {
      const sub = await stripe().subscriptions.retrieve(r.stripe_subscription_id!);
      // Una disdetta programmata su Stripe è `cancel_at_period_end` **oppure**
      // `cancel_at`: leggerne una sola è il difetto che ha fatto nascere
      // questo controllo.
      const nostro = descrivi(r.status, r.cancel_at_period_end === true || !!r.cancel_at);
      const loro = descrivi(sub.status, sub.cancel_at_period_end === true || sub.cancel_at != null);
      if (nostro !== loro) {
        divergenze.push({ userId: r.user_id, subId: sub.id, nostro, stripe: loro });
      }
    }
    return { ok: true, controllati: daControllare.length, divergenze };
  } catch (err) {
    return { ok: false, errore: err instanceof Error ? err.message : "errore sconosciuto" };
  }
}
