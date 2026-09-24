import "server-only";
import { stripe } from "@/lib/stripe";

/** Con quale carta si preleva, quando la fattura non è quella dell'abbonamento.
 *
 *  Il difetto che risolve
 *  ----------------------
 *  «There is no `default_payment_method` set on this Customer or Invoice.»
 *  È l'errore che ha bloccato il primo incasso vero di capi extra.
 *
 *  La causa: quando un cliente si abbona via Checkout, Stripe attacca la carta
 *  **alla subscription**, non al Customer. Le fatture di rinnovo funzionano
 *  perché nascono da quella subscription e la carta ce l'hanno addosso. Una
 *  fattura creata a parte — come quella dei capi extra — nasce sul Customer, che
 *  di carte predefinite non ne ha nessuna: Stripe non sa cosa usare e rifiuta.
 *
 *  Non è un problema del cliente e non è un rifiuto della banca: è una carta che
 *  c'è, e che non stavamo indicando.
 *
 *  Dove si cerca, in ordine
 *  ------------------------
 *  1. la carta dell'**abbonamento**: è quella che il cliente ha scelto per noi,
 *     e con cui si aspetta di pagare;
 *  2. quella predefinita sul **Customer**, se qualcuno l'ha impostata a mano;
 *  3. la prima carta **attaccata** al Customer, che è comunque una carta sua.
 *
 *  Se non ce n'è nessuna, non si tira a indovinare: si restituisce `null` e chi
 *  chiama lo dice in chiaro, invece di far fallire il prelievo con un messaggio
 *  tecnico che nessuno può interpretare. */
export async function metodoDiPagamento(customerId: string, subscriptionId?: string | null): Promise<string | null> {
  const sk = stripe();
  const id = (v: unknown): string | null =>
    typeof v === "string" ? v : v && typeof v === "object" && "id" in v ? String((v as { id: string }).id) : null;

  if (subscriptionId) {
    try {
      const sub = await sk.subscriptions.retrieve(subscriptionId);
      const dalla = id(sub.default_payment_method);
      if (dalla) return dalla;
    } catch {
      // Subscription non trovata (chiave di test su dati live, o cancellata):
      // si prova comunque col Customer, invece di fermarsi qui.
    }
  }

  try {
    const cust = await sk.customers.retrieve(customerId);
    if (!("deleted" in cust && cust.deleted)) {
      const predefinita = id((cust as { invoice_settings?: { default_payment_method?: unknown } }).invoice_settings?.default_payment_method);
      if (predefinita) return predefinita;
    }
  } catch {
    // idem: si passa all'ultimo tentativo.
  }

  const carte = await sk.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
  return carte.data[0]?.id ?? null;
}
