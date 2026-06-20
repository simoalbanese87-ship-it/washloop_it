/** Dati legali dell'azienda — FONTE UNICA usata da pagine legali e footer.
 *  ⚠️ I campi tra [parentesi] vanno COMPLETATI con i dati reali prima del
 *  go-live: senza, compaiono i placeholder sulle pagine pubbliche.
 *  Le pagine legali sono template tarati sullo stack reale (Supabase, Vercel,
 *  Stripe, Brevo): farle comunque validare da un legale/DPO prima del lancio. */
export const LEGAL = {
  brand: "WashLoop",
  company: "Digital Consulting S.r.l.",
  vat: "09682420964",
  fiscalCode: "09682420964",
  rea: "",
  address: "Via Franco Russoli 9, 20143 Milano (MI)",
  city: "Milano",
  email: "amministrazione@washloop.it",
  phone: "+39 392 514 8696",
  pec: "",
  privacyEmail: "privacy@washloop.it",
  // Data ultimo aggiornamento dei documenti legali.
  lastUpdated: "19 giugno 2026",
} as const;

/** True se restano placeholder da compilare (per avvisi interni). */
export const LEGAL_HAS_PLACEHOLDERS = Object.values(LEGAL).some((v) => v.includes("["));
