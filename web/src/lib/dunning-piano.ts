/** Il calendario dei solleciti, e la regola che dice se oggi ne va mandato uno.
 *
 *  Sta in un file suo, senza `server-only` e senza database, perché è la parte
 *  che sbaglia più facilmente — e sbagliarla significa o non sollecitare mai, o
 *  scrivere allo stesso cliente tutti i giorni. Il cron gira ogni mattina: la
 *  correttezza dipende tutta da questa funzione.
 *
 *  Tre contatti e poi basta. Oltre, insistere non recupera niente e diventa
 *  molestia: da lì in poi decide una persona. */

/** Quanto si aspetta prima del sollecito successivo, contando dall'ultimo
 *  inviato. Il primo parte subito al fallimento, dal webhook. */
export const ATTESA_GIORNI: Record<number, number> = {
  1: 3, // dal 1º al 2º: tre giorni
  2: 4, // dal 2º al 3º: altri quattro, cioè una settimana dal primo
};

/** L'ultimo sollecito previsto. Dopo questo non si scrive più in automatico. */
export const ULTIMO_SOLLECITO = 3;

const GIORNO_MS = 24 * 60 * 60 * 1000;

export type StatoRecupero = {
  dunning_step: number | null;
  dunning_last_sent_at: string | null;
};

/** Il prossimo sollecito da mandare, o `null` se non è ancora ora (o se non si
 *  manda più niente). Il conto parte dall'ultimo invio e non dal primo
 *  fallimento: se il cron salta un giorno il sollecito arriva in ritardo, non
 *  raddoppiato. */
export function prossimoSollecito(stato: StatoRecupero, adesso: number = Date.now()): number | null {
  const step = stato.dunning_step ?? 0;
  // 0 = non è in recupero. Il primo sollecito lo manda il webhook nel momento
  // in cui la carta viene rifiutata, non questo calendario.
  if (step <= 0) return null;
  if (step >= ULTIMO_SOLLECITO) return null;

  const attesa = ATTESA_GIORNI[step];
  if (attesa == null) return null;

  // Senza data dell'ultimo invio non si può sapere quanto è passato: meglio
  // aspettare il prossimo giro che rischiare un doppione.
  if (!stato.dunning_last_sent_at) return null;
  const ultimo = new Date(stato.dunning_last_sent_at).getTime();
  if (!Number.isFinite(ultimo)) return null;

  return adesso - ultimo >= attesa * GIORNO_MS ? step + 1 : null;
}

/** Testo del sollecito, diverso a ogni giro: lo stesso messaggio ripetuto tre
 *  volte si legge come un errore del sistema, non come un promemoria. */
export function testoSollecito(step: number, nome: string): { subject: string; title: string; body: string; push: string } {
  const conNome = nome ? `, ${nome}` : "";
  if (step <= 1) {
    return {
      subject: "Pagamento non riuscito — i ritiri sono in pausa",
      title: `Pagamento non riuscito${conNome}`,
      body:
        "Non siamo riusciti ad addebitare il canone WashLoop: può succedere per una carta scaduta o per un plafond esaurito. " +
        "I ritiri restano in pausa finché il pagamento non va a buon fine — quelli già fissati li facciamo comunque. " +
        "Si sistema in un tap dal link qui sotto.",
      push: "Pagamento non riuscito. I ritiri sono in pausa: aggiorna il pagamento.",
    };
  }
  if (step === 2) {
    return {
      subject: "Promemoria: il pagamento WashLoop è ancora in sospeso",
      title: `Il pagamento è ancora in sospeso${conNome}`,
      body:
        "Sono passati tre giorni e la fattura risulta ancora aperta, quindi i ritiri restano fermi. " +
        "Se hai già pagato, ignora questa email: potrebbero volerci alcune ore. Se il problema è la carta, cambiarla richiede un minuto.",
      push: "Il pagamento WashLoop è ancora in sospeso: i ritiri restano fermi.",
    };
  }
  return {
    subject: "Ultimo avviso prima della chiusura dell'abbonamento",
    title: `Ultimo avviso${conNome}`,
    body:
      "È passata una settimana e la fattura è ancora aperta. Questo è l'ultimo avviso automatico: se non riceviamo il pagamento " +
      "l'abbonamento verrà chiuso e i ritiri ricorrenti cancellati. Se c'è un problema, rispondi a questa email e ne parliamo — " +
      "si risolve quasi sempre.",
    push: "Ultimo avviso: l'abbonamento WashLoop sta per essere chiuso.",
  };
}

/** Dove mandiamo chi deve pagare: la fattura aperta se ce l'abbiamo, altrimenti
 *  la pagina abbonamento. Il link Stripe è sempre preferibile — non chiede di
 *  accedere e chiude la faccenda in una schermata.
 *
 *  Sta qui e non in `dunning.ts` perché lo usa anche il layout dell'area
 *  cliente, che altrimenti si tirerebbe dietro nodemailer e web-push per
 *  comporre una stringa. */
export const linkPagamento = (invoiceUrl?: string | null) =>
  invoiceUrl || `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it"}/app/abbonamento`;
