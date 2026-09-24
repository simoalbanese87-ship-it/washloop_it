/** Quante unità di un capo si addebitano davvero, tolta la franchigia.
 *
 *  «Ogni sacchetto contiene fino a 3 camicie» è parte dell'offerta che il
 *  cliente compra, e per giorni è vissuta solo come frase su un modulo: la
 *  lavanderia doveva ricordarsene e fare la sottrazione a mente. Il risultato è
 *  che, guardando un addebito, non si poteva sapere se fosse giusto — perché
 *  non era registrato quante camicie ci fossero, solo quante ne erano state
 *  messe in conto.
 *
 *  Qui la sottrazione la fa la macchina, sempre allo stesso modo. Funzione pura
 *  e testata: decide quanto paga una persona, e va potuta collaudare senza
 *  database.
 */

export type ContoFranchigia = {
  /** Quante se ne addebitano. */
  daAddebitare: number;
  /** Quante ne assorbe l'abbonamento in questa registrazione. */
  incluse: number;
  /** La franchigia totale dell'ordine, per spiegarla a chi legge. */
  franchigiaTotale: number;
};

/** @param trovate      quante ce n'erano in questo sacco
 *  @param inclusePerSacco  franchigia per sacco (3 per la camicia, 0 altrove)
 *  @param sacchi       quanti sacchi ha l'ordine
 *  @param giaConteggiate  unità dello stesso capo già registrate sull'ordine,
 *                         totali (non solo quelle addebitate): senza, due
 *                         registrazioni separate userebbero la franchigia due
 *                         volte e il cliente non pagherebbe mai il surplus. */
export function conteggiaConFranchigia(
  trovate: number,
  inclusePerSacco: number,
  sacchi: number,
  giaConteggiate = 0,
): ContoFranchigia {
  const n = Math.max(0, Math.trunc(trovate));
  const franchigiaTotale = Math.max(0, Math.trunc(inclusePerSacco)) * Math.max(1, Math.trunc(sacchi));
  if (franchigiaTotale === 0) return { daAddebitare: n, incluse: 0, franchigiaTotale: 0 };

  const residua = Math.max(0, franchigiaTotale - Math.max(0, Math.trunc(giaConteggiate)));
  const incluse = Math.min(n, residua);
  return { daAddebitare: n - incluse, incluse, franchigiaTotale };
}

/** Su quanti sacchi si calcola la franchigia.
 *
 *  Il difetto (15 settembre, lavanderia ferma)
 *  -------------------------------------------
 *  Il portale mostrava «Sacchi 1 · da confermare» e la franchigia ne usava 2.
 *  Due letture diverse dello stesso numero nella stessa schermata: la pagina
 *  scriveva `bags_arrivati ?? (bags_scansionati || bags)`, `addSpecial`
 *  `bags_arrivati ?? bags` — e si dimenticava il conteggio del rider.
 *
 *  Su un ordine da 2 sacchi previsti con 1 solo scansionato, la lavanderia ha
 *  registrato 6 camicie e il sistema le ha dichiarate **tutte comprese**: 6 di
 *  franchigia invece di 3. Da dentro il portale è un muro — si conta bene, si
 *  registra tutto, e il totale resta zero senza che niente dica perché.
 *
 *  L'ordine delle prove
 *  --------------------
 *  1. **Quanti ne ha contati la lavanderia** (`bags_arrivati`): è l'unico
 *     numero osservato con i sacchi sul banco, e vince su tutto.
 *  2. **Quanti ne ha scansionati il rider**: li ha avuti in mano lui.
 *     Vale solo se ce n'è almeno uno — a tag non letti il conteggio è zero, e
 *     zero non è una prova che non sia arrivato niente.
 *  3. **Quanti ne prevedeva l'abbonamento**: l'ultima risorsa. È un'attesa, non
 *     un fatto, e usarla per prima è ciò che ha regalato tre camicie. */
export function sacchiPerFranchigia(
  arrivati: number | null | undefined,
  scansionati: number | null | undefined,
  previsti: number | null | undefined,
  /** Quanti sacchi comprende l'abbonamento. `null` = non lo sappiamo. */
  inclusiAbbonamento?: number | null,
): number {
  return sacchiDaContare(sacchiOsservati(arrivati, scansionati, previsti), inclusiAbbonamento).sacchi;
}

/** Quanti sacchi risultano, prima di guardare l'abbonamento. */
export function sacchiOsservati(
  arrivati: number | null | undefined,
  scansionati: number | null | undefined,
  previsti: number | null | undefined,
): number {
  if (typeof arrivati === "number") return Math.max(0, Math.trunc(arrivati));
  if (typeof scansionati === "number" && scansionati > 0) return Math.trunc(scansionati);
  return Math.max(1, Math.trunc(previsti ?? 1));
}

/** Il tetto dell'abbonamento, applicato al numero osservato.
 *
 *  Perché esiste
 *  -------------
 *  Un cliente con un abbonamento da un sacco ne ha diritto a uno. Le prove che
 *  raccogliamo — i tag letti dal rider, il conteggio sul banco, la previsione
 *  della prenotazione — possono dire di più: un tag passato due volte, due
 *  etichette su un sacco solo, una prenotazione compilata a caso. Nessuna di
 *  quelle tre cose crea un diritto che l'abbonamento non dà.
 *
 *  L'8 settembre l'ordine di Giulia — abbonamento Small, un sacco — è stato
 *  pagato 24,60 €, cioè due, perché il rider aveva letto due tag e nessuno ha
 *  guardato il piano. Il tetto non è un dettaglio contabile: è la sola fonte
 *  che dice quanto è dovuto, e va guardata per prima.
 *
 *  Quando il tetto non si conosce
 *  ------------------------------
 *  Se non sappiamo quanti sacchi comprende l'abbonamento — succede su chi ha
 *  un prezzo personalizzato e nessun piano collegato — non si inventa un
 *  numero: si conta quello che si è osservato e si dice che il tetto manca. Un
 *  tetto immaginato sarebbe peggio di nessun tetto, perché nessuno saprebbe da
 *  dove viene. */
export function sacchiDaContare(
  osservati: number,
  inclusiAbbonamento?: number | null,
): { sacchi: number; limitato: boolean; tettoNoto: boolean } {
  const n = Math.max(0, Math.trunc(osservati));
  if (typeof inclusiAbbonamento !== "number" || inclusiAbbonamento < 0) {
    return { sacchi: n, limitato: false, tettoNoto: false };
  }
  const tetto = Math.trunc(inclusiAbbonamento);
  return { sacchi: Math.min(n, tetto), limitato: n > tetto, tettoNoto: true };
}

/** Rifà il conto della franchigia su righe già registrate.
 *
 *  Serve quando il numero di sacchi cambia **dopo** che i capi sono stati
 *  registrati — cioè ogni volta che la lavanderia preme «Conferma il
 *  conteggio», che è il momento in cui il numero smette di essere una stima.
 *  Senza questo, correggere i sacchi non correggeva niente: le camicie
 *  dichiarate comprese restavano comprese per sempre.
 *
 *  Le righe si servono in ordine di registrazione: la franchigia la consuma chi
 *  è arrivato prima, che è anche l'unico ordine che si può spiegare a voce. */
export function ridistribuisciFranchigia(
  righe: { id: string; qtyTotale: number }[],
  franchigiaTotale: number,
): { id: string; incluse: number; daAddebitare: number }[] {
  let residua = Math.max(0, Math.trunc(franchigiaTotale));
  return righe.map((r) => {
    const n = Math.max(0, Math.trunc(r.qtyTotale));
    const incluse = Math.min(n, residua);
    residua -= incluse;
    return { id: r.id, incluse, daAddebitare: n - incluse };
  });
}
