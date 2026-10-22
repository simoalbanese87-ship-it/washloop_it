/** Stato di lavorazione del contatto sui lead della landing /disponibilita.
 *  Sta in un modulo suo e non in `actions/leads.ts` perché un file "use server"
 *  può esportare solo funzioni async: le costanti vanno tenute fuori.
 *  I valori devono restare allineati ai check su `leads` e su `profiles`,
 *  l'ultimo dei quali sta in `supabase/migrations/0104_abbonamento_interrotto.sql`.
 *
 *  L'ordine è quello del percorso, non alfabetico: si parte da «da contattare»,
 *  si chiama, si aspetta, e si finisce in uno dei tre esiti. Un menu ordinato
 *  come il lavoro si legge senza pensarci. «Abbonamento interrotto» sta in
 *  fondo perché viene dopo tutto il resto: è l'unico stato che si raggiunge
 *  solo passando da «convertito». */

export const CONTACT_STATUS = [
  "da_contattare",
  "in_corso",
  "in_attesa",
  "fuori_zona",
  "non_interessato",
  "non_esiste",
  "convertito",
  "interrotto",
] as const;

export type ContactStatus = (typeof CONTACT_STATUS)[number];

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  da_contattare: "Da contattare",
  in_corso: "Contatto in corso",
  // La palla è dalla sua parte. Prima finiva in «Contatto in corso» insieme a
  // chi è in trattativa vera, e le due cose chiedono gesti diversi: una si
  // aspetta, l'altra si porta avanti.
  in_attesa: "Contattato, in attesa di risposta",
  // Interessato davvero, ma il suo CAP non lo serviamo. Teneva compagnia a
  // «non interessato», che è falso e per giunta dannoso: quella persona ci
  // vuole, siamo noi a non arrivarci, e il giorno che la zona si apre è la
  // prima lista da richiamare.
  fuori_zona: "Contattato, interessato ma fuori zona",
  non_interessato: "Contattato, non interessato",
  non_esiste: "Non esiste",
  convertito: "Convertito",
  // Era un cliente e ha smesso. Non è un «non interessato» — ci ha già provato
  // e ci ha già pagato — e non è nemmeno «convertito», che lo lascerebbe nei
  // conteggi di chi è stato portato dentro. È la lista da richiamare per prima
  // quando c'è una novità da raccontare.
  interrotto: "Abbonamento interrotto",
};

/** Colori dei chip: verde = chiuso bene, rosso = chiuso male, ambra = aperto.
 *  «In attesa» prende l'azzurro di «in corso»: è una conversazione aperta, non
 *  un esito, e va letta come tale anche di sfuggita. */
export const CONTACT_STATUS_TONE: Record<ContactStatus, string> = {
  da_contattare: "bg-[#C9881F]/15 text-[#C9881F]",
  in_corso: "bg-[#2b7fd4]/12 text-[#2b7fd4]",
  in_attesa: "bg-[#2b7fd4]/12 text-[#2b7fd4]",
  // Petrolio, un colore che non ha nessun altro: non è un sì né un no, è un
  // «non adesso» e si deve distinguere da tutti e due di sfuggita.
  fuori_zona: "bg-[#0F7B8A]/12 text-[#0F7B8A]",
  convertito: "bg-[#1F8A5B]/15 text-[#1F8A5B]",
  non_interessato: "bg-navy/10 text-navy",
  non_esiste: "bg-[#C0392B]/12 text-[#C0392B]",
  // Ruggine: vicino al rosso dei chiusi male ma non è quello: un abbonamento
  // interrotto si può riaprire, e il colore non deve dire «finita».
  interrotto: "bg-[#8A5A3B]/12 text-[#8A5A3B]",
};

export function isContactStatus(v: string): v is ContactStatus {
  return (CONTACT_STATUS as readonly string[]).includes(v);
}
