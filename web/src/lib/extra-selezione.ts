/** Quali capi extra entrano nell'incasso di un ritiro, e quanto fanno.
 *
 *  Sta in un file suo e **senza `server-only`** apposta: è l'unica regola vera
 *  del calcolo e si deve poter collaudare da sola col runner di Node, che
 *  `server-only` non riesce a importare. Stessa scelta già fatta per
 *  `lib/riconsegna.ts`.
 *
 *  Il filtro è la cosa che impedisce l'errore più caro di tutti: premere
 *  «pronto» due volte e addebitare due volte lo stesso capo. Dopo il primo
 *  incasso i capi hanno `charged_at`, quindi la seconda chiamata trova la lista
 *  vuota ed esce senza creare una seconda fattura. */

export type CapoSelezionabile = {
  /** Quante unità si addebitano. Zero = tutte comprese nell'abbonamento: la
   *  riga esiste per tenere il conto della franchigia, non per farsi pagare. */
  qty: number;
  charged_at: string | null;
  refunded_at: string | null;
  annullato_at: string | null;
};

/** I capi che nessuno ha ancora chiesto, tolto o rimborsato — e che hanno
 *  qualcosa da farsi pagare.
 *
 *  Il filtro su `qty` non è una precauzione teorica: le righe a zero esistono
 *  apposta, per registrare i capi coperti dalla franchigia, e una voce da zero
 *  centesimi su una fattura Stripe verrebbe rifiutata. */
export function capiDaIncassare<T extends CapoSelezionabile>(capi: T[]): T[] {
  return capi.filter((c) => c.qty > 0 && !c.charged_at && !c.refunded_at && !c.annullato_at);
}

/** Il totale, quantità comprese. */
export function totaleCents(capi: { qty: number; price_cli_cents: number }[]): number {
  return capi.reduce((t, c) => t + c.price_cli_cents * c.qty, 0);
}
