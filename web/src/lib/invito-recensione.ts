/** L'invito a recensire mandato a mano, a chi l'automatismo non ha raggiunto.
 *
 *  Due strade diverse per la stessa richiesta
 *  ------------------------------------------
 *  La strada normale è dentro l'email «Consegnato», alla **prima** riconsegna
 *  e solo lì (`notify.ts`): il bucato è appena tornato, l'impressione è fresca,
 *  e la persona ha visto tutto il giro. Quell'invito parte da solo e non si
 *  ripete mai.
 *
 *  Resta fuori chi era già cliente **prima** che l'automatismo esistesse: la
 *  sua prima consegna è passata, e per come è scritta la regola non gli verrà
 *  chiesto più niente. Sono poche persone e si contano a mano. Questo modulo
 *  scrive l'email per loro.
 *
 *  Perché è marketing e non servizio
 *  ---------------------------------
 *  L'invito automatico viaggia dentro un'email legata a un ordine: la
 *  richiesta è un di più, il motivo dell'email è la consegna. Questa invece
 *  non ha nessun ordine dietro — esiste solo per chiedere un favore. È
 *  pubblicità, quindi ha il link di disiscrizione e rispetta `email_optouts`.
 *
 *  Modulo puro e senza dipendenze: il testo si legge e si corregge qui, e i
 *  test lo tengono fermo. */

export const OGGETTO_INVITO = "Com'è andata finora?";
export const TITOLO_INVITO = "Com'è andata finora?";
export const PREHEADER_INVITO = "Se ti va, raccontalo su Google: bastano trenta secondi.";
export const CTA_INVITO = "Racconta com'è andata";

/** Il nome con cui si apre l'email.
 *
 *  Nel database i nomi sono come li ha scritti la persona iscrivendosi:
 *  «fabia marconi», «Saverio Rodriguez » con lo spazio in fondo. Si prende il
 *  primo pezzo e gli si rimette la maiuscola — scrivere «Ciao fabia» sembra
 *  una macchina che non guarda, e un «Ciao » vuoto è peggio di non salutare.
 *
 *  Nome vuoto o assente: si torna a `null` e chi chiama saluta senza nome. */
export function nomeDiCortesia(nomeCompleto: string | null | undefined): string | null {
  const primo = (nomeCompleto ?? "").trim().split(/\s+/)[0] ?? "";
  if (!primo) return null;
  return primo.charAt(0).toUpperCase() + primo.slice(1);
}

/** I numeri di quella persona, quelli veri. */
export type StoriaCliente = {
  /** Sacchi già ritirati e riportati. */
  sacchi: number;
  /** Il mese del primo ritiro, già scritto a parole: «settembre». */
  meseDiPartenza: string | null;
};

const PAROLA = [
  "zero", "un", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove",
  "dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici",
  "diciassette", "diciotto", "diciannove", "venti",
];

/** Un numero piccolo si scrive a parole: «nove sacchi» si legge, «9 sacchi»
 *  sembra una fattura. Sopra il venti si torna alle cifre. */
export function aParole(n: number): string {
  return n >= 0 && n <= 20 ? PAROLA[n] : String(n);
}

/** Il corpo dell'email, in HTML.
 *
 *  Perché è scritta così
 *  ---------------------
 *  Chiedere basta: fra chi riceve una richiesta, la grande maggioranza la
 *  recensione la scrive. Il lavoro dell'email non è convincere — è chiedere in
 *  chiaro e togliere ogni attrito. Un testo che argomenta troppo sposta
 *  l'attenzione sul perché, che è un problema nostro.
 *
 *  Quattro mosse, e sono tutte misurate altrove prima che qui:
 *
 *  - si apre con **i suoi numeri**, non con i nostri. «Da settembre ti
 *    abbiamo ritirato e riportato nove sacchi» rende la richiesta ovvia senza
 *    doverla giustificare: chi ci ha usato nove volte sa già perché gli
 *    stiamo scrivendo. È anche l'unica riga che non potremmo scrivere se non
 *    lo fossimo davvero;
 *  - **«le leggiamo tutte»**: la paura vera è scrivere nel vuoto;
 *  - **aiuta chi deve scegliere**, non aiuta noi. Una richiesta che serve a
 *    qualcun altro si accoglie meglio di una che serve a chi la fa;
 *  - **il tempo detto in chiaro** — trenta secondi — e l'asticella bassa:
 *    «va benissimo anche una riga».
 *
 *  Quello che non c'è, e di proposito: nessun numero di stelle suggerito e
 *  nessuno sconto in cambio (Google vieta entrambi, e si vede lontano un
 *  miglio), nessun lamento sulle nostre dimensioni, nessuna richiesta di
 *  dirci che cosa non va — questa email chiede una cosa sola. */
export function corpoInvito(nome: string | null, storia: StoriaCliente): string {
  const ciao = nome ? `Ciao ${nome}, ` : "";
  const da = storia.meseDiPartenza ? `da ${storia.meseDiPartenza} ` : "";

  const grezza =
    storia.sacchi >= 2
      ? `${ciao}${da}ti abbiamo ritirato e riportato <strong>${aParole(storia.sacchi)} sacchi</strong>.`
      : storia.sacchi === 1
        ? `${ciao}${da}ti abbiamo ritirato e riportato il primo sacco.`
        : `${ciao}${da}ritiriamo e riportiamo il tuo bucato.`;

  // Senza nome la frase comincia dal «da settembre»: la maiuscola gliela
  // rimettiamo qui, perché il saluto che la portava non c'è.
  const apertura = ciao ? grezza : grezza.charAt(0).toUpperCase() + grezza.slice(1);

  return (
    `${apertura}` +
    `<br/><br/>Se ti va, racconta su Google com'è andata. Le leggiamo tutte, una per una — e sono la prima ` +
    `cosa che guarda chi sta decidendo se affidare il suo bucato a qualcuno che ancora non conosce.` +
    `<br/><br/>Bastano trenta secondi. Va benissimo anche una riga.`
  );
}

/** La riga in fondo, al posto di quella standard.
 *
 *  Dice perché l'email è arrivata — è un obbligo per una comunicazione
 *  commerciale — e promette che non si ripete. La promessa è mantenuta dal
 *  codice: `recensione_chiesta_at` si scrive prima dell'invio, e sia
 *  l'automatismo sia il pannello saltano chi ce l'ha già. */
/** La fascia che si mette in cima alle copie di prova.
 *
 *  Una prova mandata a un cliente vero è un'email vera che arriva nella sua
 *  casella: deve capirlo nel primo secondo, senza aprire niente e senza
 *  chiedersi se deve fare qualcosa. Per questo sta sopra al titolo, non in
 *  fondo, e dice anche cosa succederà dopo. */
export const BANNER_PROVA =
  `<div style="margin:0 0 20px;padding:12px 16px;border-radius:12px;background:#FFF4D6;` +
  `border:1px solid #E8C45A;font-size:14px;line-height:1.5;color:#7A5A12">` +
  `<strong>Questa è una prova.</strong> La stiamo controllando prima di mandarla davvero: ` +
  `puoi ignorarla. Se ti va di scrivere la recensione lo stesso, funziona — ma non serve.` +
  `</div>`;

export const NOTA_FONDO_INVITO =
  "Ricevi questa email perché sei cliente WashLoop. È una richiesta una tantum: non te la rimandiamo.";
