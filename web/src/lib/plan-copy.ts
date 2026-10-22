/** Copy dei piani (tagline + features) — FONTE UNICA condivisa da home, onboarding
 *  e area cliente, così i recap non divergono più. Chiave = `code` del piano in DB
 *  (essential = Small, plus = Medium, family = Large). */

export type PlanCopy = { tagline: string; features: string[] };

export const PLAN_COPY: Record<string, PlanCopy> = {
  essential: {
    tagline: "Per chi vive da solo",
    features: [
      "Un sacco a settimana, giorno fisso",
      "Lavato, stirato e piegato",
      "Fino a 3 camicie stirate per sacco",
      "Pausa di un mese dall'app",
      "Nessun vincolo di durata",
    ],
  },
  plus: {
    tagline: "Il preferito dei professionisti",
    features: [
      "Due sacchi a settimana, stesso giorno",
      "Lavato, stirato e piegato",
      "Fino a 6 camicie stirate a settimana",
      "Lenzuola e biancheria senza accumuli",
      "Pausa di un mese dall'app",
    ],
  },
  family: {
    tagline: "Per coppie e famiglie",
    features: [
      "Tre sacchi a settimana, stesso giorno",
      "Lavato, stirato e piegato",
      "Fino a 9 camicie stirate a settimana",
      "Il prezzo a sacco più basso del listino",
      "Pausa di un mese dall'app",
    ],
  },
  // Il solo stiro: capi già lavati in casa, stirati e piegati dalla stireria.
  // Non è un piano più piccolo della lavanderia, è un altro lavoro — e il
  // recap deve dirlo nella prima riga, che è l'unica che molti leggono.
  stiro: {
    tagline: "Hai la lavatrice, non hai tempo di stirare",
    features: [
      // Niente giorno fisso: lo stiro si ritira il lunedì e il mercoledì, e
      // `planRecap` prende le prime tre — una riga falsa finirebbe dritta nel
      // recap dell'area cliente.
      "Stirato, piegato, pronto da riporre",
      "Un sacco a settimana di capi già lavati",
      "Niente lavaggio: quello lo fai tu",
      "Metti in pausa quando vuoi",
    ],
  },
};

/** Riga recap compatta di un piano (per onboarding / area cliente): le prime 3
 *  feature separate da «·». Ritorna null se il code non è mappato. */
export function planRecap(code: string | null | undefined): string | null {
  const c = code ? PLAN_COPY[code] : undefined;
  return c ? c.features.slice(0, 3).join(" · ") : null;
}
