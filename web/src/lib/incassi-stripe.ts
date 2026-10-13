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

/** I rimborsi già registrati sulle ricevute, per mese.
 *
 *  Stripe non toglie l'importo rimborsato da `amount_paid` della fattura: per
 *  lui quella fattura resta pagata, ed è corretto — è successo. Ma per noi
 *  «incassato» significa «rimasto», e senza questa sottrazione la home
 *  continuerebbe a contare soldi già tornati al cliente mentre la pagina
 *  incassi, che ora li toglie, direbbe un'altra cifra. Due totali diversi nello
 *  stesso pannello e nessuno che sa quale credere.
 *
 *  La fonte è `invoices.rimborsato_cents`, che scrive il webhook
 *  `charge.refunded`. */
export async function rimborsiPerMese(
  dallIso: string,
  /** Dove si sta accumulando il rimborso, pezzo per pezzo: serve a togliere un
   *  canone restituito dalla fetta dei canoni e non da quella degli extra. Si
   *  riempie solo se chi chiama passa la mappa `stripe_invoice_id → pezzo`. */
  pezzoDi?: Map<string, PezzoIncasso>,
  perPezzo?: Map<string, { canoniCents: number; extraCents: number }>,
): Promise<Map<string, number>> {
  const { createServiceClient } = await import("@/lib/supabase/server");
  const per = new Map<string, number>();
  try {
    const { data } = await createServiceClient()
      .from("invoices")
      .select("rimborsato_cents, rimborsato_at, stripe_invoice_id")
      .not("rimborsato_at", "is", null)
      .gte("rimborsato_at", dallIso)
      .returns<{ rimborsato_cents: number | null; rimborsato_at: string; stripe_invoice_id: string | null }[]>();
    for (const r of data ?? []) {
      // Il rimborso pesa sul mese in cui il denaro è uscito, non su quello in
      // cui era entrato: è così che lo vede il conto corrente.
      const k = meseRoma(Math.floor(Date.parse(r.rimborsato_at) / 1000));
      const quanto = r.rimborsato_cents ?? 0;
      per.set(k, (per.get(k) ?? 0) + quanto);
      if (perPezzo) {
        const acc = perPezzo.get(k) ?? { canoniCents: 0, extraCents: 0 };
        // Se non sappiamo da dove veniva — fattura più vecchia della finestra
        // letta su Stripe — si toglie dai canoni, che è il grosso.
        if (r.stripe_invoice_id && pezzoDi?.get(r.stripe_invoice_id) === "extra") acc.extraCents += quanto;
        else acc.canoniCents += quanto;
        perPezzo.set(k, acc);
      }
    }
  } catch (err) {
    console.error("[incassi] lettura dei rimborsi fallita:", err);
  }
  return per;
}
