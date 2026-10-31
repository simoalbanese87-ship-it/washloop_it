import "server-only";
import { stripe } from "@/lib/stripe";

/** Di cosa è fatto un mese di incassi, secondo Stripe.
 *
 *  Perché esiste ancora
 *  --------------------
 *  **Non per contare i soldi.** Quelli si contano in `cassa.ts`, dal registro,
 *  con una regola sola: la data in cui si muovono. Questo file nacque per
 *  supplire a un webhook che non arrivava e la tabella restava vuota; da
 *  allora il registro è completo, e tenere due fonti per lo stesso numero ha
 *  prodotto esattamente quello che doveva produrre — la Home diceva 690,60 €
 *  e la pagina Incassi 733,10 € per lo stesso ottobre.
 *
 *  Resta per una cosa che il registro non sa: **se una fattura è un canone o
 *  un extra**. Lo dice `billing_reason`, che vive su Stripe e basta. Serve a
 *  colorare le barre del grafico, non ad alzarle: se Stripe non risponde il
 *  totale non cambia di un centesimo e la barra si disegna di un pezzo solo.
 *
 *  Si guardano le **fatture pagate** e non i pagamenti grezzi: una fattura
 *  pagata è un incasso riconciliato, mentre i `charge` includono tentativi e
 *  movimenti che non sono ricavo. Per questo qui i pagamenti singoli non ci
 *  sono — e per questo questo file non può essere la fonte dei totali.
 */

export type IncassoMese = {
  chiave: string;
  totaleCents: number;
  quanti: number;
  /** Quanto di quel mese sono **canoni**: le fatture nate da un abbonamento.
   *  Lo dice Stripe con `billing_reason`, che su un rinnovo è
   *  `subscription_cycle` e su una fattura fuori ciclo è `manual`. */
  canoniCents: number;
  /** Il resto: capi fuori abbonamento e addebiti incassati subito. */
  extraCents: number;
};

/** A quale pezzo appartiene una fattura. Serve anche dopo, per togliere un
 *  rimborso dal pezzo giusto invece che dal totale. */
export type PezzoIncasso = "canone" | "extra";

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
export async function incassiStripePerMese(
  dalEpochSec: number,
  /** Si riempie strada facendo: `stripe_invoice_id` → canone o extra. Chi
   *  sottrae i rimborsi lo usa per toglierli dal pezzo giusto della barra. */
  pezzoDi?: Map<string, PezzoIncasso>,
): Promise<Map<string, IncassoMese> | null> {
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
      const acc = per.get(k) ?? { chiave: k, totaleCents: 0, quanti: 0, canoniCents: 0, extraCents: 0 };
      // `subscription_*` = rinnovo, creazione o modifica di un abbonamento.
      // Tutto il resto — `manual` su una fattura fuori ciclo — è un extra: i
      // capi e gli addebiti che incassiamo subito.
      const pezzo: PezzoIncasso = String(inv.billing_reason ?? "").startsWith("subscription") ? "canone" : "extra";
      if (inv.id) pezzoDi?.set(inv.id, pezzo);
      acc.totaleCents += importo;
      if (pezzo === "canone") acc.canoniCents += importo;
      else acc.extraCents += importo;
      acc.quanti++;
      per.set(k, acc);
    }
    return per;
  } catch (err) {
    console.error("[incassi] lettura da Stripe fallita:", err);
    return null;
  }
}

