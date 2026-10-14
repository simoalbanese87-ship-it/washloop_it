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
    features: ["2 sacchi a settimana", "Ritiro 1 volta a settimana", "Fino a 6 camicie stirate a settimana", "Lavaggio + stiratura premium", "Tracciabilità capo per capo"],
  },
  family: {
    tagline: "Per coppie e famiglie",
    features: ["3 sacchi a settimana", "Ritiro 1 volta a settimana", "Fino a 9 camicie stirate a settimana", "Capi delicati inclusi", "Slot prioritari"],
  },
  // Il solo stiro: capi già lavati in casa, stirati e piegati dalla stireria.
  // Non è un piano più piccolo della lavanderia, è un altro lavoro — e il
  // recap deve dirlo nella prima riga, che è l'unica che molti leggono.
  stiro: {
    tagline: "Hai la lavatrice, non hai tempo di stirare",
    features: ["Capi già lavati da te", "Ritiro il mercoledì", "Torna in 48 ore, piegato", "1 sacco a settimana", "Metti in pausa quando vuoi"],
  },
};

/** Riga recap compatta di un piano (per onboarding / area cliente): le prime 3
 *  feature separate da «·». Ritorna null se il code non è mappato. */
export function planRecap(code: string | null | undefined): string | null {
  const c = code ? PLAN_COPY[code] : undefined;
  return c ? c.features.slice(0, 3).join(" · ") : null;
}
