/** Come si racconta lo stato di un abbonamento, in una riga sola.
 *
 *  Il difetto che questo modulo chiude
 *  -----------------------------------
 *  Chi preme «Disdici» resta `active` su Stripe fino a fine periodo — è giusto,
 *  il servizio gli spetta perché l'ha pagato. Ma la sua pagina gli diceva
 *  **«Attivo · Rinnovo il 30/09»**, cioè esattamente il contrario di quello che
 *  aveva appena chiesto. Chi legge conclude che la disdetta non ha funzionato e
 *  che gli verrà riaddebitato.
 *
 *  Non era un caso isolato: lo stato veniva etichettato in sei posti diversi,
 *  ognuno con la sua mappa, e **nessuno** guardava `cancel_at_period_end` —
 *  tranne la scheda admin, che lo ricomponeva a mano.
 *
 *  Perché la parola e la data stanno insieme
 *  -----------------------------------------
 *  Perché separarle è ciò che ha prodotto il difetto: la data `current_period_end`
 *  è la stessa in entrambi i casi, cambia solo se quel giorno si rinnova o si
 *  finisce. Chi scrive «Rinnovo il {data}» sta indovinando; qui la coppia si
 *  decide una volta e si usa così com'è. */

export type DatiAbbonamento = {
  status: string | null | undefined;
  /** Disdetta programmata: su Stripe lo stato resta `active` fino alla fine. */
  cancelAtPeriodEnd?: boolean | null;
  /** L'altra disdetta programmata di Stripe: non «a fine periodo» ma **a una
   *  data**. Stripe ne usa una sola delle due, e noi leggevamo solo la prima:
   *  una disdetta messa a data arrivava con `cancelAtPeriodEnd` falso e
   *  l'abbonamento risultava semplicemente attivo. */
  cancelAt?: string | null;
  /** Fine del periodo pagato, ISO. */
  periodEnd?: string | null;
  /** Fine della prova gratuita, ISO: durante la prova la data che conta è questa. */
  provaFineAt?: string | null;
};

export type EtichettaAbbonamento = {
  /** «Attivo», «In prova», «Disdetto»… */
  stato: string;
  /** La coppia parola+data, già decisa insieme. `null` se non c'è una data. */
  quando: { parola: string; iso: string } | null;
  /** Verde = va tutto bene, ambra = richiede attenzione, grigio = finito. */
  tono: "bene" | "attenzione" | "finito";
  /** Il servizio è utilizzabile adesso (anche se disdetto a fine periodo). */
  attivo: boolean;
  /** Ha chiesto di non rinnovare, ma il periodo pagato non è finito. */
  disdettaProgrammata: boolean;
};

const STATO_IT: Record<string, string> = {
  active: "Attivo",
  trialing: "In prova",
  past_due: "Pagamento in sospeso",
  unpaid: "Non pagato",
  canceled: "Disdetto",
  paused: "In pausa",
  incomplete: "Da completare",
  incomplete_expired: "Scaduto senza pagamento",
  pending: "Da attivare",
};

export function etichettaAbbonamento(d: DatiAbbonamento): EtichettaAbbonamento {
  const status = d.status ?? "";
  const inProva = status === "trialing";
  const attivo = status === "active" || inProva;
  // L'una **o** l'altra: sono due modi di dire la stessa cosa, e guardarne una
  // sola è ciò che ha fatto dire «rinnovo oggi» a un abbonamento già disdetto.
  const disdettaProgrammata = attivo && (d.cancelAtPeriodEnd === true || !!d.cancelAt);

  const stato = disdettaProgrammata
    ? // Non è «Attivo» e non è ancora «Disdetto»: è lo stato in cui sta chi ha
      // premuto il bottone nel caso normale, e merita una parola sua.
      "Attivo, in scadenza"
    : STATO_IT[status] ?? (status || "Nessun abbonamento");

  // Quando finisce davvero: se la disdetta è a data, è quella — e può cadere
  // prima della fine del periodo pagato. Scrivere `periodEnd` direbbe al
  // cliente una data più in là di quella in cui gli si spegne il servizio.
  const fine = disdettaProgrammata && d.cancelAt ? d.cancelAt : d.periodEnd;
  const quando = inProva && d.provaFineAt
    ? { parola: "Primo addebito", iso: d.provaFineAt }
    : fine
      ? { parola: disdettaProgrammata ? "Finisce" : attivo ? "Rinnovo" : "Fino al", iso: fine }
      : null;

  const tono: EtichettaAbbonamento["tono"] = disdettaProgrammata
    ? "attenzione"
    : attivo
      ? "bene"
      : status === "past_due" || status === "unpaid" || status === "incomplete"
        ? "attenzione"
        : "finito";

  return { stato, quando, tono, attivo, disdettaProgrammata };
}

/** La riga pronta da stampare: «Rinnovo il 30/09/2026», «Finisce il 30/09/2026».
 *  `fmt` è la formattazione della data del chiamante (`fmtDate`), così questo
 *  modulo resta puro e collaudabile senza fuso orario intorno. */
export function rigaQuando(e: EtichettaAbbonamento, fmt: (iso: string) => string): string | null {
  return e.quando ? `${e.quando.parola} il ${fmt(e.quando.iso)}` : null;
}
