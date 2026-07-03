/** Copy dei piani (tagline + features) — FONTE UNICA condivisa da home, onboarding
 *  e area cliente, così i recap non divergono più. Chiave = `code` del piano in DB
 *  (essential = Small, plus = Medium, family = Large). */

export type PlanCopy = { tagline: string; features: string[] };

export const PLAN_COPY: Record<string, PlanCopy> = {
  essential: {
    tagline: "Per chi vive da solo",
    features: ["1 sacco a settimana", "Ritiro 1 volta a settimana", "Fino a 3 camicie per sacchetto", "Lavaggio + stiratura inclusi", "Metti in pausa quando vuoi"],
  },
  plus: {
    tagline: "Il preferito dei professionisti",
    features: ["2 sacchi a settimana", "Ritiro 1 volta a settimana", "Cumuli i sacchi nel mese", "Lavaggio + stiratura premium", "Tracciabilità capo per capo"],
  },
  family: {
    tagline: "Per coppie e famiglie",
    features: ["3 sacchi a settimana", "Ritiro 1 volta a settimana", "Cumuli i sacchi nel mese", "Capi delicati inclusi", "Slot prioritari"],
  },
};

/** Riga recap compatta di un piano (per onboarding / area cliente): le prime 3
 *  feature separate da «·». Ritorna null se il code non è mappato. */
export function planRecap(code: string | null | undefined): string | null {
  const c = code ? PLAN_COPY[code] : undefined;
  return c ? c.features.slice(0, 3).join(" · ") : null;
}
