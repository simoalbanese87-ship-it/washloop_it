import "server-only";
import { stripe, siteUrl } from "@/lib/stripe";

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
      endpointNostro: { url: string; attivo: boolean; eventi: number } | null;
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
        ? { url: nostro.url, attivo: nostro.status === "enabled", eventi: nostro.enabled_events?.length ?? 0 }
        : null,
      fatturePagate,
      incassatoCents,
    };
  } catch (err) {
    return { ok: false, errore: err instanceof Error ? err.message : "errore sconosciuto" };
  }
}
