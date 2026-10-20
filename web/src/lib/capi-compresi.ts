/** Quante unità di un capo paga il cliente, e quante ne paghiamo noi.
 *
 *  Due comprensioni, e non sono la stessa cosa
 *  -------------------------------------------
 *  - **Comprese nel sacco** (`special_items.incluse_per_sacco`, le tre camicie
 *    della 0059): stanno dentro il compenso del sacco che versiamo comunque.
 *    Non le paga il cliente e non le paghiamo a parte.
 *  - **Comprese nel canone** (`capi_compresi`, i quattro maglioni di Savino):
 *    il cliente non le paga perché gliele abbiamo vendute nel canone, ma la
 *    lavanderia quel capo l'ha lavorato e va pagata. Stessa regola del capo
 *    regalato (0068).
 *
 *  Tenerle separate è il punto: è la differenza fra le due a dire chi paga, e
 *  un contatore solo la perderebbe.
 *
 *  L'ordine di consumo è una decisione sui soldi
 *  ---------------------------------------------
 *  **Prima il sacco, poi il canone.** La franchigia del sacco non ci costa
 *  niente; un capo compreso nel canone ci costa il compenso della lavanderia.
 *  Consumando prima quella gratis, il cliente paga lo stesso e a noi costa
 *  meno — e un diritto mensile non si brucia su una cosa già coperta.
 *  Invertendo l'ordine nessuno se ne accorgerebbe guardando la fattura del
 *  cliente: cambierebbe solo il nostro conto.
 *
 *  Modulo puro con i test: decide quanto paga una persona e quanto paghiamo
 *  noi, e sbaglia in silenzio. */

export type ContoCapo = {
  /** Quante se ne addebitano al cliente. */
  daAddebitare: number;
  /** Assorbite dalla franchigia del sacco. */
  incluseSacco: number;
  /** Assorbite dai capi compresi nel canone. */
  incluseCanone: number;
  /** Quante se ne pagano alla lavanderia: addebitate + comprese nel canone. */
  daPagare: number;
  /** La franchigia del sacco dell'ordine, per spiegarla a chi legge. */
  franchigiaSaccoTotale: number;
  /** Quante ne restavano nel canone prima di questa registrazione. */
  canoneResiduoPrima: number;
  /** E quante ne restano dopo. */
  canoneResiduoDopo: number;
};

const intero = (v: unknown, minimo = 0): number => {
  const n = typeof v === "number" ? Math.trunc(v) : NaN;
  return Number.isFinite(n) ? Math.max(minimo, n) : minimo;
};

export function conteggiaCapo(input: {
  /** Quante ne sono state trovate in questa registrazione. */
  trovate: number;
  /** Franchigia per sacco, già passata da `franchigiaPerSacco()`: zero per chi
   *  non ha un abbonamento attivo. */
  inclusePerSacco: number;
  /** Quanti sacchi ha l'ordine, osservati davvero. */
  sacchi: number;
  /** Unità dello stesso capo già registrate **su questo ordine**, totali. */
  giaConteggiateSullOrdine?: number;
  /** Quante ne comprende il canone per ciclo. `null` = nessun diritto. */
  canoneSpettanti?: number | null;
  /** Quante ne ha già assorbite il canone in questo ciclo, su tutti gli
   *  ordini — questo compreso, se ci sono registrazioni precedenti. */
  canoneGiaUsate?: number;
}): ContoCapo {
  const trovate = intero(input.trovate);
  const franchigiaSaccoTotale = intero(input.inclusePerSacco) * intero(input.sacchi);
  const giaSullOrdine = intero(input.giaConteggiateSullOrdine);

  // Quanta franchigia del sacco resta: quella totale meno le unità dello
  // stesso capo già registrate su questo ordine. Si contano i totali, non gli
  // addebitati, o due registrazioni separate userebbero la franchigia due
  // volte (è il difetto chiuso dalla 0067).
  const saccoResiduo = Math.max(0, franchigiaSaccoTotale - giaSullOrdine);
  const incluseSacco = Math.min(trovate, saccoResiduo);

  const spettanti = input.canoneSpettanti;
  const canoneAttivo = typeof spettanti === "number" && Number.isFinite(spettanti) && spettanti > 0;
  const canoneResiduoPrima = canoneAttivo
    ? Math.max(0, Math.trunc(spettanti) - intero(input.canoneGiaUsate))
    : 0;

  const restanti = trovate - incluseSacco;
  const incluseCanone = Math.min(restanti, canoneResiduoPrima);

  const daAddebitare = restanti - incluseCanone;

  return {
    daAddebitare,
    incluseSacco,
    incluseCanone,
    // Il sacco non si paga a parte, il canone sì.
    daPagare: daAddebitare + incluseCanone,
    franchigiaSaccoTotale,
    canoneResiduoPrima,
    canoneResiduoDopo: canoneResiduoPrima - incluseCanone,
  };
}

/** Quante unità si pagano alla lavanderia, da una riga già scritta.
 *
 *  Esiste perché la regola stia in un posto solo: due funzioni creano i
 *  compensi e quattro schermate li mostrano. Nel database la stessa somma è la
 *  colonna generata `order_specials.qty_pagata`; qui serve a chi ha in mano la
 *  riga prima di scriverla. */
export function quantoPagaLaLavanderia(r: { qty: number; qty_inclusa_canone?: number | null }): number {
  return intero(r.qty) + intero(r.qty_inclusa_canone);
}

/** Ridistribuisce il diritto del canone su righe già scritte, in ordine di
 *  registrazione. Gemella di `ridistribuisciFranchigia`: chi è arrivato prima
 *  consuma per primo, che è anche l'unico ordine che si può spiegare a voce. */
export function ridistribuisciCanone(
  righe: { id: string; daCoprire: number }[],
  residuo: number,
): { id: string; incluseCanone: number }[] {
  let piatto = intero(residuo);
  return righe.map((r) => {
    const n = intero(r.daCoprire);
    const incluseCanone = Math.min(n, piatto);
    piatto -= incluseCanone;
    return { id: r.id, incluseCanone };
  });
}

export type DirittoCapo = {
  /** Come si chiama, per dirlo a chi legge. */
  nome: string;
  spettanti: number;
  usate: number;
};

/** Il saldo detto a chi legge, non a chi programma. Gemella di
 *  `frasePassaggi`. `null` quando non c'è nessun diritto configurato: a chi non
 *  ha capi compresi non si dice niente, perché non è cambiato niente per lui. */
export function fraseCapiCompresi(diritti: DirittoCapo[], scadeIl?: string | null): string | null {
  if (diritti.length === 0) return null;
  const entro = scadeIl
    ? ` · si azzerano il ${new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit" }).format(new Date(scadeIl))}`
    : "";
  const pezzi = diritti.map((d) => {
    const restano = Math.max(0, d.spettanti - d.usate);
    if (restano === 0) return `${d.nome}: usate tutte (${d.usate} di ${d.spettanti})`;
    return `${d.nome}: ${d.usate} di ${d.spettanti}, ${restano === 1 ? "ne resta 1" : `ne restano ${restano}`}`;
  });
  return `${pezzi.join(" · ")}${entro}`;
}

export type Periodo = { dalIso: string; alIso: string; fonte: "rinnovo" | "attivazione" | "mese" };

/** Il ciclo pagato di un abbonamento, con la fonte della risposta.
 *
 *  `cicloCorrente` (`passaggi-inclusi.ts`) risponde solo a chi ha una data di
 *  rinnovo, e quella la scrive Stripe: su un abbonamento manuale tornerebbe
 *  `null` — cioè nessun capo compreso, proprio sul tipo di cliente per cui
 *  questa regola è stata scritta. Qui ci sono due ripieghi, e **la fonte si
 *  dichiara a schermo**: un periodo dedotto senza dirlo è peggio di nessun
 *  periodo, come il tetto dei sacchi che non si inventa. */
export function periodoDelCanone(
  sub: { current_period_end?: string | null; activated_at?: string | null },
  adesso: Date,
): Periodo {
  const fine = sub.current_period_end ? new Date(sub.current_period_end) : null;
  if (fine && !Number.isNaN(fine.getTime())) {
    const inizio = new Date(fine);
    const giorno = inizio.getUTCDate();
    inizio.setUTCMonth(inizio.getUTCMonth() - 1);
    if (inizio.getUTCDate() !== giorno) inizio.setUTCDate(0);
    return { dalIso: inizio.toISOString(), alIso: fine.toISOString(), fonte: "rinnovo" };
  }

  const ancora = sub.activated_at ? new Date(sub.activated_at) : null;
  if (ancora && !Number.isNaN(ancora.getTime())) {
    // Il ciclo mensile ancorato al giorno di attivazione che contiene `adesso`.
    const giorno = ancora.getUTCDate();
    const dal = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), giorno, 0, 0, 0));
    if (dal.getTime() > adesso.getTime()) dal.setUTCMonth(dal.getUTCMonth() - 1);
    if (dal.getUTCDate() !== giorno) dal.setUTCDate(0);
    const al = new Date(dal);
    al.setUTCMonth(al.getUTCMonth() + 1);
    if (al.getUTCDate() !== dal.getUTCDate()) al.setUTCDate(0);
    return { dalIso: dal.toISOString(), alIso: al.toISOString(), fonte: "attivazione" };
  }

  const dal = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), 1));
  const al = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth() + 1, 1));
  return { dalIso: dal.toISOString(), alIso: al.toISOString(), fonte: "mese" };
}

/** Quante unità ha consumato il canone, lette da righe già scritte.
 *
 *  Una riga **annullata** libera il diritto: se il cappotto non c'era, torna
 *  nel piatto. Una riga **rimborsata** no: il rimborso riguarda i soldi, il
 *  capo è stato lavorato e il diritto è stato speso. */
export function canoneUsateDaRighe(
  righe: { qty_inclusa_canone?: number | null; annullato_at?: string | null }[],
): number {
  return righe.reduce((t, r) => (r.annullato_at ? t : t + intero(r.qty_inclusa_canone)), 0);
}
