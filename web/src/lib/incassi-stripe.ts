import "server-only";
import { stripe } from "@/lib/stripe";

/** Gli incassi letti da Stripe, che è dove i soldi arrivano davvero.
 *
 *  Perché esiste
 *  -------------
 *  Il pannello mostrava «0 € incassati questo mese» mentre gli abbonamenti
 *  venivano pagati. Non era un errore di calcolo: la Home legge la tabella
 *  `invoices`, che si popola dal webhook `invoice.payment_succeeded` — e quel
 *  webhook non arriva. La tabella è vuota da sempre, quindi ogni mese risulta
 *  a zero.
 *
 *  Il webhook va sistemato (è configurazione nel cruscotto Stripe), ma finché
 *  la fonte del numero è un evento che può non arrivare, quel numero non è
 *  affidabile. Qui si chiede a Stripe, che è l'unico posto che sa con certezza
 *  quanto è stato incassato.
 *
 *  Si contano le **fatture pagate** e non i pagamenti grezzi: una fattura pagata
 *  è un incasso riconciliato, mentre i `charge` includono tentativi, rimborsi
 *  parziali e movimenti che non sono ricavo.
 */

export type IncassoMese = { chiave: string; totaleCents: number; quanti: number };

/** Chiave `YYYY-MM` in ora di Roma: contare in UTC sposterebbe di mese chi paga
 *  la notte dell'ultimo giorno. */
function meseRoma(epochSec: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" })
    .format(new Date(epochSec * 1000))
    .slice(0, 7);
}

/** Totali per mese delle fatture pagate, dal timestamp indicato a oggi.
 *
 *  Ritorna `null` — e non una mappa vuota — quando Stripe non è raggiungibile:
 *  chi chiama deve poter distinguere «non ho incassato niente» da «non lo so»,
 *  che è esattamente la confusione da cui nasce questo file. */
export async function incassiStripePerMese(dalEpochSec: number): Promise<Map<string, IncassoMese> | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;

  try {
    const per = new Map<string, IncassoMese>();
    // `autoPagingEach` segue la paginazione da solo. Il tetto è una difesa: su
    // un account con anni di storico questa pagina non deve diventare eterna.
    let letti = 0;
    for await (const inv of stripe().invoices.list({
      status: "paid",
      created: { gte: dalEpochSec },
      limit: 100,
      expand: [],
    })) {
      if (++letti > 2000) break;
      const pagata = inv.status_transitions?.paid_at ?? inv.created;
      const importo = inv.amount_paid ?? 0;
      if (importo <= 0) continue;
      const k = meseRoma(pagata);
      const acc = per.get(k) ?? { chiave: k, totaleCents: 0, quanti: 0 };
      acc.totaleCents += importo;
      acc.quanti++;
      per.set(k, acc);
    }
    return per;
  } catch (err) {
    console.error("[incassi] lettura da Stripe fallita:", err);
    return null;
  }
}
