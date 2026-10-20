/** Da quando a quando un abbonamento copre le settimane di un mese.
 *
 *  Serviva perché la regola è cambiata: la quota del canone matura in tutte le
 *  settimane coperte, non solo in quelle con un ritiro. Un cliente ha comprato
 *  il servizio, che lo usi o no — e Federica, con i suoi due ritiri nella
 *  stessa settimana, faceva sparire dai ricavi tre settimane di abbonamento
 *  pagato.
 *
 *  Il rischio nuovo è l'opposto: ricavi che compaiono dal nulla. Finché serviva
 *  un ritiro, spingere nel conto ogni riga di `subscriptions` era innocuo;
 *  spalmando, ogni checkout abbandonato e ogni prova gratuita comincerebbero a
 *  produrre canone in ogni settimana di ogni mese. Per questo qui si risponde
 *  anche `null`: **non copre niente**.
 *
 *  Modulo puro con i test. */

import type { CanoneStorico } from "@/lib/conto-settimanale";

export type SubCopertura = {
  user_id: string;
  status: string;
  created_at: string;
  activated_at?: string | null;
  canceled_at?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
  prova_fine_at?: string | null;
  termina_dopo_settimane?: number | null;
  custom_price_cents?: number | null;
  /** Il prezzo del piano collegato, quando non c'è un prezzo su misura. */
  prezzoPianoCents?: number | null;
};

const piuTardi = (a: string | null | undefined, b: string | null | undefined): string | null => {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
};

export function coperturaDelCanone(s: SubCopertura, oggiIso: string): CanoneStorico | null {
  // Mai pagato, mai coperto. `created_at` è quando la riga è nata — anche per
  // un checkout aperto e abbandonato — mentre `activated_at` è la prima volta
  // che Stripe ha incassato.
  if ((s.status === "incomplete" || s.status === "incomplete_expired") && !s.activated_at) return null;

  // L'inizio: il primo giorno in cui quel canone è in vigore **ed è pagato**.
  //
  // `prova_fine_at` è il giorno del primo addebito (0076): la prima settimana
  // è gratis, e contarla a prezzo pieno sarebbe un ricavo inventato. Chi è in
  // prova adesso ha quella data nel futuro, quindi non copre ancora niente —
  // ed è coerente con il resto del pannello, che conta solo chi paga.
  const daIso = s.prova_fine_at ?? s.activated_at ?? s.created_at;

  const canoneCents = s.custom_price_cents ?? s.prezzoPianoCents ?? 0;
  if (canoneCents <= 0) return null;

  // La fine: l'ultimo giorno pagato.
  let aIso: string | null;
  if (s.status === "canceled") {
    // `canceled_at` è la data in cui la disdetta è stata **chiesta**, non
    // quella in cui il servizio finisce. Su una disdetta a fine periodo il
    // cliente resta servito fino al rinnovo: prendere la data della richiesta
    // taglierebbe settimane pagate e servite.
    aIso = s.cancel_at_period_end
      ? piuTardi(s.canceled_at, s.current_period_end)
      : s.canceled_at ?? s.current_period_end ?? null;
  } else if (s.status === "paused") {
    // Non esiste una data di messa in pausa: `current_period_end` è la miglior
    // cosa vera che abbiamo — «pagato fino a lì».
    aIso = s.current_period_end ?? oggiIso;
  } else if (s.status === "past_due" || s.status === "unpaid") {
    // L'ultimo periodo pagato, e non un giorno di più.
    aIso = s.current_period_end ?? null;
  } else {
    // Attivo: fino al rinnovo. È anche il tetto che impedisce a un mese futuro
    // di riempirsi di canone per tutti.
    aIso = s.current_period_end ?? oggiIso;
  }

  if (aIso && aIso < daIso) return null;

  return {
    clienteId: s.user_id,
    canoneCents,
    daIso,
    aIso,
    // I pacchetti a termine restano quello che sono: coprono le loro settimane,
    // e in `conto-settimanale.ts` continuano a maturare solo dove c'è un
    // ritiro. Un pacchetto compra N settimane *di servizio*, e quando
    // cominciano lo dice il primo ritiro, non la data del pagamento.
    settimaneCoperte: s.termina_dopo_settimane ?? null,
  };
}
