"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** Stato condiviso della landing: il CAP scritto nell'hero e il piano scelto
 *  dalle card arrivano al form in fondo alla pagina, che sta in un'altra sezione.
 *  Serve un contesto perché le due sezioni sono renderizzate separatamente dal
 *  server component della pagina. */

export type PlanCode = "S" | "M" | "L";

type Ctx = {
  cap: string;
  setCap: (v: string) => void;
  plan: PlanCode;
  setPlan: (v: PlanCode) => void;
  /** Imposta i valori e porta l'utente al form. */
  goToForm: (v?: { cap?: string; plan?: PlanCode }) => void;
};

const LeadCtx = createContext<Ctx | null>(null);

export function LeadProvider({ children }: { children: React.ReactNode }) {
  const [cap, setCap] = useState("");
  const [plan, setPlan] = useState<PlanCode>("M"); // "Più scelto" come da pagina

  const goToForm = useCallback((v?: { cap?: string; plan?: PlanCode }) => {
    if (v?.cap !== undefined) setCap(v.cap);
    if (v?.plan !== undefined) setPlan(v.plan);
    // Niente `behavior: "smooth"`: in alcuni contesti l'animazione non parte e
    // la pagina resta ferma. Meglio uno scroll certo che uno elegante ma incerto.
    document.getElementById("richiesta")?.scrollIntoView({ block: "start" });
  }, []);

  const value = useMemo(() => ({ cap, setCap, plan, setPlan, goToForm }), [cap, plan, goToForm]);
  return <LeadCtx.Provider value={value}>{children}</LeadCtx.Provider>;
}

export function useLead(): Ctx {
  const ctx = useContext(LeadCtx);
  if (!ctx) throw new Error("useLead va usato dentro <LeadProvider>");
  return ctx;
}
