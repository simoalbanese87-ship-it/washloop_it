"use client";

import { useState } from "react";
import { segnaCompitoFatto } from "@/lib/actions/compiti";

export type CompitoRider = {
  id: string;
  tipo: "dotazione" | "rientro";
  cliente: string;
  /** Il codice stampato sui cartellini: è quello che il rider cerca. */
  clientCode: string | null;
  indirizzo: string;
  zona: string | null;
  telefono: string | null;
  /** `YYYY-MM-DD`, già formattato per la lettura. */
  scadeIl: string | null;
  /** In ritardo rispetto a oggi. */
  inRitardo: boolean;
  /** Cosa gli manca davvero, in parole: cartellini, sacco, o entrambi. */
  manca: string | null;
};

const TESTI = {
  dotazione: {
    titolo: "Porta il materiale",
    bottone: "Consegnato",
    fatto: "Materiale consegnato ✓",
  },
  rientro: {
    titolo: "Riprendi il materiale",
    bottone: "Ripreso",
    fatto: "Materiale ripreso ✓",
  },
} as const;

/** Un compito nel giro del rider: dare il materiale, o riprenderlo.
 *
 *  Non è una fermata e non è un ordine, e si vede: nessun numero di tappa,
 *  nessuno stato da far avanzare. Un compito finto travestito da ordine
 *  romperebbe compensi, conteggi e storico — è la cosa da non fare scritta
 *  nella migration 0099. */
export function CompitoCard({ compito }: { compito: CompitoRider }) {
  const [inCorso, setInCorso] = useState(false);
  const [fatto, setFatto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const t = TESTI[compito.tipo];

  if (fatto) {
    return (
      <div className="rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3">
        <p className="font-display text-sm font-extrabold text-[#1F8A5B]">{t.fatto}</p>
        <p className="mt-0.5 text-xs font-medium text-muted">{compito.cliente}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[14px] border-2 bg-white px-4 py-3 ${
        compito.inRitardo ? "border-[#C0392B]/40" : "border-navy/15"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-sm font-extrabold text-navy">{t.titolo}</span>
        {compito.scadeIl && (
          <span className={`text-[11px] font-bold ${compito.inRitardo ? "text-[#C0392B]" : "text-muted"}`}>
            {compito.inRitardo ? "era per il " : "entro il "}
            {compito.scadeIl}
          </span>
        )}
      </div>

      <p className="mt-1 font-display text-base font-extrabold text-navy">{compito.cliente}</p>
      <p className="text-sm font-medium text-muted">
        {compito.indirizzo}
        {compito.zona ? ` · ${compito.zona}` : ""}
      </p>

      {compito.manca && (
        <p className="mt-1.5 text-xs font-semibold text-navy">
          {compito.tipo === "dotazione" ? "Da portare: " : "Da riprendere: "}
          {compito.manca}
          {compito.clientCode && compito.tipo === "dotazione" ? (
            <>
              {" "}
              · cartellini <span className="font-mono font-bold">{compito.clientCode}</span>
            </>
          ) : null}
        </p>
      )}

      {errore && <p className="mt-1.5 text-[11px] font-semibold text-[#C0392B]">{errore}</p>}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={inCorso}
          onClick={async () => {
            setInCorso(true);
            setErrore(null);
            const res = await segnaCompitoFatto(compito.id, 2);
            setInCorso(false);
            if (res.ok) setFatto(true);
            else setErrore(res.error ?? "Non riuscito, riprova");
          }}
          className="inline-flex items-center rounded-full bg-gradient-to-br from-blue to-cyan px-4 py-2 font-display text-xs font-extrabold text-white disabled:opacity-50"
        >
          {inCorso ? "Salvo…" : t.bottone}
        </button>
        {compito.telefono && (
          <a
            href={`tel:${compito.telefono}`}
            className="inline-flex items-center rounded-full border-2 border-navy/20 px-4 py-2 font-display text-xs font-bold text-navy"
          >
            Chiama
          </a>
        )}
      </div>
    </div>
  );
}
