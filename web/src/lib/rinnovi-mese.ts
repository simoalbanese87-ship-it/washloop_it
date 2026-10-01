/** Quanto entrerebbe ancora questo mese se tutti rinnovassero.
 *
 *  La barra del mese in corso è sempre più bassa delle altre, e non perché
 *  stiamo andando peggio: perché il mese non è finito. Il primo di ottobre
 *  mostra un incasso di un giorno accanto a settembre intero, e la lettura a
 *  colpo d'occhio è «stiamo crollando».
 *
 *  Questo è il pezzo che manca: i rinnovi degli abbonamenti attivi la cui data
 *  di addebito cade nei giorni che restano. Non è una previsione di crescita —
 *  non ci sono dentro clienti nuovi, né capi extra, né nulla che debba ancora
 *  succedere: sono addebiti già programmati su Stripe, su carte già registrate.
 *
 *  Chi ha già disdetto resta fuori: il suo abbonamento è attivo oggi ma non si
 *  rinnoverà, e contarlo sarebbe l'unico modo di far dire a questa barra una
 *  cifra che non arriverà mai. */

export type SubPerRinnovo = {
  prezzoCents: number;
  /** La data del prossimo addebito, come la sa Stripe. */
  periodEndIso: string | null;
  /** Disdetta già programmata: finisce, non rinnova. */
  disdetto: boolean;
};

export type RinnoviAttesi = { totaleCents: number; quanti: number };

/** Anno-mese in ora di Roma: `getMonth()` sposterebbe di un mese chi guarda il
 *  primo del mese a mezzanotte e mezza. */
export function meseRoma(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" })
    .format(new Date(iso))
    .slice(0, 7);
}

export function rinnoviDelMese(subs: SubPerRinnovo[], meseChiave: string, adessoMs: number): RinnoviAttesi {
  let totaleCents = 0;
  let quanti = 0;
  for (const s of subs) {
    if (s.disdetto) continue;
    if (!s.periodEndIso) continue;
    if (s.prezzoCents <= 0) continue;
    const quando = new Date(s.periodEndIso).getTime();
    if (!Number.isFinite(quando)) continue;
    // Già passata: o l'addebito è arrivato — e allora sta negli incassi veri —
    // oppure è fallito, e sommarlo qui lo farebbe sembrare incassato.
    if (quando <= adessoMs) continue;
    if (meseRoma(s.periodEndIso) !== meseChiave) continue;
    totaleCents += s.prezzoCents;
    quanti++;
  }
  return { totaleCents, quanti };
}
