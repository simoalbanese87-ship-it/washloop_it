/** Quanto ha davvero pagato un cliente, oltre al canone: il saldo dei capi
 *  extra e degli addebiti fuori ordine.
 *
 *  Il difetto che questo modulo chiude
 *  -----------------------------------
 *  La scheda cliente calcolava «addebiti netti» come `addebiti − storni` sulla
 *  sola tabella `customer_charges`. Ma un capo extra addebitato **non scrive
 *  niente lì dentro**: vive in `order_specials` con `charged_at`. Quando invece
 *  lo rimborsi o lo annulli, una riga `refund` in `customer_charges` ci finisce
 *  eccome. Il risultato è una sottrazione fra una colonna quasi sempre vuota e
 *  una che si riempie: **il numero poteva solo essere zero o negativo**, su
 *  qualunque cliente.
 *
 *  Su Giulia diceva −35,00 €, e la lettura naturale — «le abbiamo dato indietro
 *  35 euro netti» — era falsa due volte: i soldi restituiti erano 14,00 €, e il
 *  saldo vero era zero, perché tutto ciò che le era stato addebitato le è stato
 *  reso.
 *
 *  Un annullamento non è un rimborso
 *  ---------------------------------
 *  Quando si annulla un addebito mai incassato, il codice scrive comunque una
 *  riga `kind: 'refund'` — ma senza `stripe_ref`, perché nessun soldo si è
 *  mosso. Contarla fra i rimborsi significa dichiarare un'uscita che non c'è
 *  stata: erano 21,00 € dei 35 di Giulia.
 *
 *  La stessa correzione esiste già nelle metriche globali
 *  (`admin-metrics.ts`), con un commento che racconta questo identico errore.
 *  Qui la si porta dove il numero si legge cliente per cliente. */

export type CapoExtra = {
  qty: number;
  price_cli_cents: number;
  /** Addebitato al cliente (messo in fattura). */
  charged_at?: string | null;
  refunded_at?: string | null;
  /** Riferimento del rimborso su Stripe: serve a riconoscere la riga gemella
   *  in `customer_charges` e a non contare due volte lo stesso storno. */
  refund_ref?: string | null;
  annullato_at?: string | null;
};

export type AddebitoManuale = {
  amount_cents: number;
  /** `charge` oppure `refund`. */
  kind: string;
  /** `void` = annullato, non conta da nessuna parte. */
  status: string;
  /** Riferimento del rimborso su Stripe. Vuoto = nessun soldo si è mosso. */
  stripe_ref?: string | null;
};

export type SaldoAddebiti = {
  /** Quanto gli è stato messo in conto, capi extra compresi. */
  addebitatoCents: number;
  /** Quanto gli è tornato indietro davvero, con i soldi che si sono mossi. */
  stornatoCents: number;
  /** La differenza: quanto ha pagato in più del canone. */
  nettoCents: number;
  /** Annullamenti: tolti dal conto senza che nessun soldo sia uscito. */
  annullatoCents: number;
};

/** Il saldo degli extra di un cliente.
 *
 *  Un capo conta come addebitato se `charged_at` è valorizzato, indipendentemente
 *  dal fatto che l'incasso sia poi andato a buon fine: «gli è stato chiesto» e
 *  «ha pagato» sono due domande diverse, e questa risponde alla prima. */
export function saldoAddebiti(capi: CapoExtra[], manuali: AddebitoManuale[]): SaldoAddebiti {
  let addebitatoCents = 0;
  let stornatoCents = 0;
  let annullatoCents = 0;

  for (const c of capi) {
    const val = Math.max(0, c.price_cli_cents) * Math.max(0, c.qty);
    // Annullato = tolto prima che partisse: non è mai stato un addebito, e
    // trattarlo come un rimborso è ciò che faceva sparire 21 € dal saldo.
    if (c.annullato_at) {
      annullatoCents += val;
      continue;
    }
    if (!c.charged_at) continue;
    addebitatoCents += val;
    // Il rimborso del capo si conta qui, dal capo stesso: la riga gemella in
    // `customer_charges` viene esclusa sotto, o lo stesso rimborso finirebbe
    // contato due volte.
    if (c.refunded_at) stornatoCents += val;
  }

  // Ogni rimborso o annullamento di un capo scrive **anche** una riga in
  // `customer_charges`: il rimborso con lo `stripe_ref`, l'annullamento senza.
  // Sono gemelle di quello che i capi hanno già raccontato, e contarle di nuovo
  // è l'errore che questo modulo esiste per non rifare.
  const refDeiCapi = new Set(capi.map((c) => c.refund_ref).filter((r): r is string => !!r));

  for (const m of manuali) {
    if (m.status === "void") continue;
    if (m.kind === "refund") {
      // Gemella di un rimborso già contato dal capo.
      if (m.stripe_ref && refDeiCapi.has(m.stripe_ref)) continue;
      // Senza riferimento Stripe nessun soldo si è mosso: o è la gemella di un
      // annullamento (già contato sopra), o è una nota contabile. In nessuno
      // dei due casi è denaro uscito, e va tenuta fuori dal saldo.
      if (!m.stripe_ref) continue;
      stornatoCents += Math.max(0, m.amount_cents);
      continue;
    }
    addebitatoCents += Math.max(0, m.amount_cents);
  }

  return {
    addebitatoCents,
    stornatoCents,
    nettoCents: addebitatoCents - stornatoCents,
    annullatoCents,
  };
}
