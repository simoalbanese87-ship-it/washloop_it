/** Dati legali dell'azienda — FONTE UNICA usata da pagine legali e footer.
 *  ⚠️ I campi tra [parentesi] vanno COMPLETATI con i dati reali prima del
 *  go-live: senza, compaiono i placeholder sulle pagine pubbliche.
 *  Le pagine legali sono template tarati sullo stack reale (Supabase, Vercel,
 *  Stripe, Brevo): farle comunque validare da un legale/DPO prima del lancio. */
export const LEGAL = {
  brand: "WashLoop",
  company: "Digital Consulting S.r.l.",
  vat: "[PARTITA IVA]",
  fiscalCode: "[CODICE FISCALE]",
  rea: "[REA / Camera di Commercio]",
  address: "[SEDE LEGALE — via e civico, CAP, città]",
  city: "[Città]",
  email: "amministrazione@washloop.it",
  phone: "+39 392 514 8696",
  pec: "[PEC]",
  privacyEmail: "privacy@washloop.it",
  // Data ultimo aggiornamento dei documenti legali.
  lastUpdated: "19 giugno 2026",
} as const;

/** True se restano placeholder da compilare (per avvisi interni). */
export const LEGAL_HAS_PLACEHOLDERS = Object.values(LEGAL).some((v) => v.includes("["));
