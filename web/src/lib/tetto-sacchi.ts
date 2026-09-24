/** Quanti sacchi a settimana comprende un abbonamento: la scelta fra le fonti.
 *
 *  Il numero esiste in tre posti, e non dicono la stessa cosa:
 *
 *  1. **Sull'abbonamento** (`subscriptions.bags_per_week`) — quello concordato
 *     con quella persona. Vince su tutto, perché è l'unico che qualcuno ha
 *     scritto di proposito per lei.
 *  2. **Sul piano** (`plans.bags_per_week`) — quello che ha comprato a listino.
 *  3. **Sul ritiro settimanale** (`recurring_pickups.bags`) — un ripiego
 *     osservativo, non un accordo: è una richiesta del cliente, che può
 *     cambiare senza che nessuno la approvi.
 *
 *  `null` quando nessuna delle tre lo dice, e allora **non si inventa**: chi
 *  chiama conta quello che ha osservato e dichiara che il tetto manca.
 *
 *  Perché lo `0` viene scartato invece di essere accettato
 *  ------------------------------------------------------
 *  `sacchiDaContare` tratta qualunque numero non negativo come tetto valido, e
 *  uno zero azzererebbe il compenso alla lavanderia e la franchigia sulle
 *  camicie senza che nessuno se ne accorga. «Zero sacchi compresi» non è un
 *  abbonamento che esiste: è un campo compilato male. Meglio dire che il tetto
 *  non si sa — che è vero — che dire che è zero. */
export function scegliTetto(
  daAbbonamento?: number | null,
  daPiano?: number | null,
  daRicorrenza?: number | null,
): number | null {
  for (const n of [daAbbonamento, daPiano, daRicorrenza]) {
    if (typeof n === "number" && Number.isInteger(n) && n > 0) return n;
  }
  return null;
}
