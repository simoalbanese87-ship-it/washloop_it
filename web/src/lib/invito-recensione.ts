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

export const OGGETTO_INVITO = "Ci aiuti a crescere?";
export const TITOLO_INVITO = "Ci aiuti a crescere?";
export const PREHEADER_INVITO = "Su Google abbiamo una recensione sola. La seconda può essere la tua.";
export const CTA_INVITO = "Scrivi due righe su Google";

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

/** Il corpo dell'email, in HTML.
 *
 *  Perché è scritta così
 *  ---------------------
 *  Non si chiede una recensione: si chiede una mano. È la stessa azione, ma
 *  «lasciaci una recensione» mette la persona al servizio di un nostro numero,
 *  mentre «aiutaci a crescere» le dice che cosa cambia davvero — e per
 *  un'attività di tre mesi è la verità, non una cortesia.
 *
 *  Il dato va detto preciso e va detto giusto: **una** recensione, non zero.
 *  Un numero gonfiato al ribasso per fare pena si smonta da solo nel momento
 *  in cui la persona clicca e vede la scheda.
 *
 *  Poi le tre righe nell'ordine che conta: chi siamo (piccoli, e si vede),
 *  che cosa chiediamo (un minuto), e la porta sul retro per chi invece ha
 *  qualcosa da ridire. L'ultima non è gentilezza: chiedere una recensione
 *  senza offrire un canale privato è il modo in cui una lamentela diventa
 *  pubblica. */
export function corpoInvito(nome: string | null): string {
  const saluto = nome ? `Ciao ${nome}, siamo` : "Siamo";
  return (
    `${saluto} partiti da pochi mesi e siamo in pochissimi: nessun negozio, nessun call center. ` +
    `I sacchi li ritiriamo e li riportiamo noi.` +
    `<br/><br/>Per crescere ci serve una cosa che non si compra — quello che dice chi ci ha già provato. ` +
    `Su Google per ora abbiamo <strong>una recensione sola</strong>: la seconda potrebbe essere la tua.` +
    `<br/><br/>Ti porta via un minuto, e per un'attività piccola come la nostra conta più di qualsiasi ` +
    `pubblicità. Se invece c'è qualcosa che non ha funzionato, <a href="mailto:info@washloop.it">scrivicelo</a> ` +
    `prima: preferiamo saperlo noi e rimediare.`
  );
}

/** La riga in fondo, al posto di quella standard.
 *
 *  Dice perché l'email è arrivata — è un obbligo per una comunicazione
 *  commerciale — e promette che non si ripete. La promessa è mantenuta dal
 *  codice: `recensione_chiesta_at` si scrive prima dell'invio, e sia
 *  l'automatismo sia il pannello saltano chi ce l'ha già. */
export const NOTA_FONDO_INVITO =
  "Ricevi questa email perché sei cliente WashLoop. È una richiesta una tantum: non te la rimandiamo.";
