/** Gli eventi Stripe che il nostro webhook sa gestire.
 *
 *  Sta qui, e non dentro la route, perché due cose diverse devono poterlo
 *  leggere: chi li gestisce (`api/stripe/webhook`) e chi controlla che su
 *  Stripe siano davvero spuntati (`/admin/sicurezza`). Finché la lista viveva
 *  solo nel `switch` del gestore, il pannello poteva dire soltanto «6 eventi
 *  ascoltati» — un numero verde che non sa quali mancano.
 *
 *  Ed è successo: `charge.refunded` non era spuntato, quindi un rimborso fatto
 *  dalla dashboard non arrivava mai nel registro, e `customer.subscription.
 *  trial_will_end` nemmeno, quindi l'avviso «la prova sta per finire» non
 *  partiva. Il codice per gestirli c'era da mesi e aspettava un messaggio che
 *  non sarebbe mai arrivato.
 *
 *  Aggiungendo un `case` al gestore, va aggiunta una riga qui: il controllo in
 *  pannello diventa rosso finché non è spuntato anche su Stripe. */
export const EVENTI_STRIPE_GESTITI = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "charge.refunded",
] as const;

/** Quelli che il gestore sa trattare ma Stripe non ci manda: sono codice morto
 *  finché qualcuno non li spunta, e non si vedono da nessuna parte. */
export function eventiNonAscoltati(spuntatiSuStripe: readonly string[]): string[] {
  const spuntati = new Set(spuntatiSuStripe);
  // `*` o `*.*`: su Stripe vuol dire «mandami tutto», e allora non manca niente.
  if (spuntati.has("*") || spuntati.has("*.*")) return [];
  return EVENTI_STRIPE_GESTITI.filter((e) => !spuntati.has(e));
}
