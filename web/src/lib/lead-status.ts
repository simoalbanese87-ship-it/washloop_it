/** Stato di lavorazione del contatto sui lead della landing /disponibilita.
 *  Sta in un modulo suo e non in `actions/leads.ts` perché un file "use server"
 *  può esportare solo funzioni async: le costanti vanno tenute fuori.
 *  I valori devono restare allineati al check in
 *  `supabase/migrations/0036_leads_contact_status.sql`. */

export const CONTACT_STATUS = ["da_contattare", "non_esiste", "non_interessato", "in_corso", "convertito"] as const;

export type ContactStatus = (typeof CONTACT_STATUS)[number];

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  da_contattare: "Da contattare",
  non_esiste: "Non esiste",
  non_interessato: "Contattato, non interessato",
  in_corso: "Contatto in corso",
  convertito: "Convertito",
};

/** Colori dei chip: verde = chiuso bene, rosso = chiuso male, ambra = aperto. */
export const CONTACT_STATUS_TONE: Record<ContactStatus, string> = {
  da_contattare: "bg-[#C9881F]/15 text-[#C9881F]",
  in_corso: "bg-[#2b7fd4]/12 text-[#2b7fd4]",
  convertito: "bg-[#1F8A5B]/15 text-[#1F8A5B]",
  non_interessato: "bg-navy/10 text-navy",
  non_esiste: "bg-[#C0392B]/12 text-[#C0392B]",
};

export function isContactStatus(v: string): v is ContactStatus {
  return (CONTACT_STATUS as readonly string[]).includes(v);
}
