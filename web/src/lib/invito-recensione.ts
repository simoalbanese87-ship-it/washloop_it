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

export const OGGETTO_INVITO = "Due righe su Google?";
export const TITOLO_INVITO = "Due righe su Google?";
export const PREHEADER_INVITO = "Se è andata bene, una recensione vale più di qualsiasi pubblicità.";

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
 *  Tre cose, in quest'ordine: che cosa chiediamo, perché conta, e la via
 *  d'uscita per chi invece ha qualcosa da dirci in privato. L'ultima non è
 *  gentilezza: chiedere una recensione senza offrire un canale privato è il
 *  modo in cui una lamentela diventa pubblica. */
export function corpoInvito(nome: string | null): string {
  const saluto = nome ? `Ciao ${nome}, ti` : "Ti";
  return (
    `${saluto} scriviamo per una cosa sola, e piccola: su Google WashLoop non ha ancora nessuna recensione.` +
    `<br/><br/>Il giro l'hai visto tutto — il ritiro sotto casa, il lavaggio, il sacco che torna. ` +
    `Se è andata bene, due righe su Google ci aiutano più di qualsiasi pubblicità: siamo pochissimi, ` +
    `e chi ci cerca per ora trova una scheda vuota.` +
    `<br/><br/>Ci vuole un minuto. Se invece qualcosa non è andato come doveva, ` +
    `<a href="mailto:info@washloop.it">scrivici</a>: preferiamo saperlo noi.`
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
