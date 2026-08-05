"use client";

import { useState } from "react";
import { useLead } from "./LeadContext";

/** Mini-form CAP dell'hero. Non invia nulla: porta il CAP al form completo in
 *  fondo alla pagina, dove il lead viene davvero raccolto. */
export function CapHeroForm() {
  const { goToForm } = useLead();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        goToForm({ cap: value.trim() });
      }}
      className="mt-9 max-w-lg"
    >
      <label htmlFor="hero-cap" className="mb-2 block font-display text-xs font-extrabold uppercase tracking-[0.14em] text-cyan">
        Il tuo CAP
      </label>
      <div className="flex flex-col gap-2.5 rounded-[40px] border border-white/15 bg-white/5 p-2 sm:flex-row sm:items-center">
        <input
          id="hero-cap"
          name="cap"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          pattern="\d{5}"
          placeholder="Inserisci il tuo CAP"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 5))}
          className="min-h-[48px] flex-1 rounded-[40px] bg-transparent px-5 text-base font-semibold text-white placeholder:text-white/40 outline-none"
        />
        <button
          type="submit"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[40px] bg-grad px-6 font-display text-[15px] font-extrabold text-white shadow-[var(--shadow-cy)] transition-all hover:brightness-105"
        >
          Verifica disponibilità →
        </button>
      </div>
      <p className="mt-3 font-display text-xs font-bold text-white/45">
        Milano e hinterland sud-ovest: Assago, Buccinasco, Rozzano.
      </p>
    </form>
  );
}
