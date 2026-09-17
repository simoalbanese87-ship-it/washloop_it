"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { esitoCap, formatoCapValido, type EsitoCap } from "@/lib/copertura";

/** Il CAP scritto in cima e il verdetto, condivisi con il form in fondo.
 *
 *  Le due parti stanno in sezioni diverse della pagina, renderizzate separate
 *  dal server component: senza un contesto, il CAP scritto nell'hero non
 *  arriverebbe al form e la persona lo riscriverebbe. Riscrivere un dato appena
 *  dato è il punto in cui si abbandona un modulo.
 *
 *  `verificato` esiste perché il verdetto va mostrato **dopo** che qualcuno ha
 *  chiesto, non appena il campo raggiunge cinque cifre: un «non ti copriamo»
 *  che compare mentre stai ancora digitando è una porta in faccia data da sola. */

type Ctx = {
  cap: string;
  setCap: (v: string) => void;
  verificato: boolean;
  esito: EsitoCap | null;
  /** Fissa il CAP, segna la verifica come fatta e porta al form. */
  verifica: (cap: string) => void;
};

const ZonaCtx = createContext<Ctx | null>(null);

export function ZonaProvider({ children }: { children: React.ReactNode }) {
  const [cap, setCapState] = useState("");
  const [verificato, setVerificato] = useState(false);

  // Cambiando il CAP il verdetto precedente non vale più: lasciarlo a schermo
  // direbbe «siamo nella tua zona» sopra un numero diverso da quello valutato.
  const setCap = useCallback((v: string) => {
    setCapState(v);
    setVerificato(false);
  }, []);

  const verifica = useCallback((v: string) => {
    const pulito = v.trim();
    setCapState(pulito);
    setVerificato(formatoCapValido(pulito));
    // Niente `behavior: "smooth"`: in alcuni contesti l'animazione non parte e
    // la pagina resta ferma. Meglio uno scroll certo che uno elegante e incerto.
    document.getElementById("richiesta")?.scrollIntoView({ block: "start" });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      cap,
      setCap,
      verificato,
      esito: verificato && formatoCapValido(cap) ? esitoCap(cap) : null,
      verifica,
    }),
    [cap, setCap, verificato, verifica],
  );
  return <ZonaCtx.Provider value={value}>{children}</ZonaCtx.Provider>;
}

export function useZona(): Ctx {
  const ctx = useContext(ZonaCtx);
  if (!ctx) throw new Error("useZona va usato dentro <ZonaProvider>");
  return ctx;
}
