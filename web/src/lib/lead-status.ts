/** Stato di lavorazione del contatto sui lead della landing /disponibilita.
 *  Sta in un modulo suo e non in `actions/leads.ts` perché un file "use server"
 *  può esportare solo funzioni async: le costanti vanno tenute fuori.
 *  I valori devono restare allineati ai check su `leads` e su `profiles`,
 *  l'ultimo dei quali sta in `supabase/migrations/0079_contattato_in_attesa.sql`.
 *
 *  L'ordine è quello del percorso, non alfabetico: si parte da «da contattare»,
 *  si chiama, si aspetta, e si finisce in uno dei tre esiti. Un menu ordinato
 *  come il lavoro si legge senza pensarci. */

export const CONTACT_STATUS = [
  "da_contattare",
  "in_corso",
  "in_attesa",
  "non_interessato",
  "non_esiste",
  "convertito",
] as const;

export type ContactStatus = (typeof CONTACT_STATUS)[number];

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  da_contattare: "Da contattare",
  in_corso: "Contatto in corso",
  // La palla è dalla sua parte. Prima finiva in «Contatto in corso» insieme a
  // chi è in trattativa vera, e le due cose chiedono gesti diversi: una si
  // aspetta, l'altra si porta avanti.
  in_attesa: "Contattato, in attesa di risposta",
  non_interessato: "Contattato, non interessato",
  non_esiste: "Non esiste",
  convertito: "Convertito",
};

/** Colori dei chip: verde = chiuso bene, rosso = chiuso male, ambra = aperto.
 *  «In attesa» prende l'azzurro di «in corso»: è una conversazione aperta, non
 *  un esito, e va letta come tale anche di sfuggita. */
export const CONTACT_STATUS_TONE: Record<ContactStatus, string> = {
  da_contattare: "bg-[#C9881F]/15 text-[#C9881F]",
  in_corso: "bg-[#2b7fd4]/12 text-[#2b7fd4]",
  in_attesa: "bg-[#2b7fd4]/12 text-[#2b7fd4]",
  convertito: "bg-[#1F8A5B]/15 text-[#1F8A5B]",
  non_interessato: "bg-navy/10 text-navy",
  non_esiste: "bg-[#C0392B]/12 text-[#C0392B]",
};

export function isContactStatus(v: string): v is ContactStatus {
  return (CONTACT_STATUS as readonly string[]).includes(v);
}
