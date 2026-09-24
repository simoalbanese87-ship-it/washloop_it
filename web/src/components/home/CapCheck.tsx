"use client";

import { useState } from "react";
import { useZona } from "./ZonaContext";
import { formatoCapValido } from "@/lib/copertura";

/** Il controllo CAP dell'hero: la prima cosa che si vede e l'unica da fare.
 *
 *  Non invia niente e non decide niente da solo — porta il CAP al form in
 *  fondo, dove il contatto viene davvero raccolto. Chiedere il CAP per primo è
 *  la scelta di questa pagina: è l'unica domanda a cui una persona risponde
 *  senza pensarci, e apre la conversazione invece di chiuderla con un modulo. */
export function CapCheck() {
  const { cap, setCap, verifica } = useZona();
  const [toccato, setToccato] = useState(false);
  const valido = formatoCapValido(cap);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setToccato(true);
        if (valido) verifica(cap);
      }}
      noValidate
      className="mt-9 max-w-md rounded-[24px] bg-white p-5 shadow-[var(--shadow-md)]"
    >
      <label htmlFor="cap-hero" className="mb-2 flex items-center gap-1.5 font-display text-xs font-extrabold uppercase tracking-[0.14em] text-navy/50">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
        Il tuo CAP
      </label>
      <input
        id="cap-hero"
        name="cap"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        placeholder="Es. 20143"
        value={cap}
        onChange={(e) => setCap(e.target.value.replace(/\D/g, "").slice(0, 5))}
        aria-invalid={toccato && !valido ? true : undefined}
        aria-describedby={toccato && !valido ? "cap-hero-errore" : undefined}
        className="min-h-[52px] w-full rounded-[14px] border border-line bg-ice px-4 font-display text-lg font-extrabold text-navy outline-none transition-colors placeholder:font-semibold placeholder:text-navy/30 focus:border-blue"
      />
      {/* L'errore compare solo dopo un tentativo: mentre si digita, «CAP
          incompleto» è vero a ogni cifra e non aiuta nessuno. */}
      {toccato && !valido && (
        <p id="cap-hero-errore" role="alert" className="mt-2 text-sm font-semibold text-[#C0392B]">
          Il CAP è di 5 cifre.
        </p>
      )}
      <button
        type="submit"
        className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[40px] bg-grad px-6 font-display text-base font-extrabold text-white shadow-[var(--shadow-cy)] transition-all hover:brightness-105"
      >
        Controlla il mio CAP →
      </button>
    </form>
  );
}
