/** Toglie dai messaggi tutto ciò che somiglia a una credenziale.
 *
 *  Non è teorico: il primo guasto vero registrato da questo modulo è stato un
 *  `TypeError` di `Headers.set` che riportava **per intero la chiave di
 *  servizio Supabase**. È finita in tabella e da lì nell'email di riepilogo
 *  agli admin. Un registro dei guasti che si porta dietro i segreti è peggio
 *  del problema che risolve, e la cautela va messa qui — nel punto in cui si
 *  scrive — non nei singoli chiamanti, che non possono sapere cosa contenga
 *  l'errore che stanno propagando. */
const SEGRETI: RegExp[] = [
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, // JWT (anon e service role)
  /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/g,                  // chiavi Stripe
  /\bwhsec_[A-Za-z0-9]{8,}/g,                                   // firma webhook Stripe
  /\bsbp_[A-Za-z0-9]{8,}/g,                                     // token Supabase Management
  /\bBearer\s+[A-Za-z0-9._-]{16,}/gi,
];

export function ripulisci(testo: string): string {
  let out = testo;
  for (const r of SEGRETI) out = out.replace(r, "[credenziale rimossa]");
  return out;
}
