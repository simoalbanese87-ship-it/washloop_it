/** Quanti passaggi comprende un abbonamento, e quanti ne restano.
 *
 *  Il problema che risolve
 *  -----------------------
 *  Marta Savino ha comprato «due volte al mese». Il sistema sapeva dire se uno
 *  **può** prenotare (`puo-prenotare.ts`: un cancello, aperto o chiuso), non
 *  **quante volte** — e la risposta, al telefono, si dava contando gli ordini a
 *  mano. Qui si conta sempre allo stesso modo.
 *
 *  Il periodo è il ciclo pagato
 *  ----------------------------
 *  Non il mese solare: quello che finisce a `current_period_end`. È la data che
 *  Stripe rispetta e che il cliente ha davanti; col mese solare, chi si abbona
 *  il 28 avrebbe due giorni per usarsi il mese.
 *
 *  Modulo puro con i test: decide quanto servizio ha diritto una persona che
 *  paga, e si sbaglia in silenzio. */

/** L'inizio del ciclo in corso, dato il giorno in cui finisce.
 *
 *  Si va indietro di un mese dalla fine: il ciclo di Stripe è mensile e
 *  l'ancora è il giorno dell'attivazione. Il 31 gennaio meno un mese cade sul
 *  28 febbraio, che è lo stesso giorno in cui lo porta Stripe.
 *
 *  `null` quando non c'è una fine: un abbonamento senza periodo non ha un
 *  ciclo da contare, e inventarne uno vorrebbe dire azzerare il saldo a una
 *  data a caso. */
export function cicloCorrente(
  currentPeriodEnd: string | null | undefined,
): { dalIso: string; alIso: string } | null {
  if (!currentPeriodEnd) return null;
  const fine = new Date(currentPeriodEnd);
  if (Number.isNaN(fine.getTime())) return null;

  const inizio = new Date(fine);
  const giorno = inizio.getUTCDate();
  inizio.setUTCMonth(inizio.getUTCMonth() - 1);
  // Mesi corti: il 31 marzo meno un mese diventerebbe il 3 marzo, perché
  // JavaScript trabocca sul mese dopo. Si torna all'ultimo giorno buono.
  if (inizio.getUTCDate() !== giorno) inizio.setUTCDate(0);

  return { dalIso: inizio.toISOString(), alIso: fine.toISOString() };
}

export type ContoPassaggi = {
  /** Quanti ne ha diritto in questo ciclo, riporti compresi. `null` = nessun
   *  tetto: è il caso di tutti gli abbonamenti storici. */
  spettanti: number | null;
  usati: number;
  /** Quanti ne restano. `null` quando non c'è un tetto. Mai negativo: quello
   *  che sfora sta in `oltre`, che è un'altra cosa e si racconta diversamente. */
  residui: number | null;
  /** Quanti ne ha fatti oltre il suo diritto. È il numero da cui parte una
   *  telefonata, non un errore da bloccare. */
  oltre: number;
};

export function contoPassaggi(input: {
  /** `subscriptions.passaggi_per_ciclo`. */
  perCiclo?: number | null;
  /** `subscriptions.passaggi_riportati`: quelli fatti scorrere a mano. */
  riportati?: number | null;
  /** Ordini non annullati con il ritiro dentro il ciclo. */
  usati: number;
}): ContoPassaggi {
  const usati = Math.max(0, Math.trunc(input.usati || 0));
  const perCiclo = input.perCiclo;

  if (typeof perCiclo !== "number" || !Number.isFinite(perCiclo) || perCiclo <= 0) {
    return { spettanti: null, usati, residui: null, oltre: 0 };
  }

  const riportati = Math.max(0, Math.trunc(input.riportati ?? 0));
  const spettanti = Math.trunc(perCiclo) + riportati;
  return {
    spettanti,
    usati,
    residui: Math.max(0, spettanti - usati),
    oltre: Math.max(0, usati - spettanti),
  };
}

/** Il saldo detto a chi legge, non a chi programma.
 *
 *  `null` per chi non ha un tetto: a quelli non si dice niente di nuovo, perché
 *  non è cambiato niente per loro. */
export function frasePassaggi(c: ContoPassaggi, scadeIl?: string | null): string | null {
  if (c.spettanti == null) return null;
  const entro = scadeIl ? ` entro il ${fmtGiorno(scadeIl)}` : "";
  if (c.oltre > 0) {
    return `${c.usati} passaggi su ${c.spettanti}: ${c.oltre} oltre il piano${entro ? ` in questo periodo` : ""}.`;
  }
  if (c.residui === 0) return `${c.usati} di ${c.spettanti}: li hai usati tutti${entro}.`;
  return `${c.usati} di ${c.spettanti} · ${c.residui === 1 ? "ne resta 1" : `ne restano ${c.residui}`}${entro}.`;
}

function fmtGiorno(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit" }).format(
    new Date(iso),
  );
}
