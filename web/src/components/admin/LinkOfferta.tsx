"use client";

import { useState } from "react";

/** Il link di pagamento di una proposta aperta: si copia, non si legge.
 *
 *  Mostrato per intero occupava metà della colonna con duecento caratteri di
 *  URL Stripe che nessuno leggerà mai — e per mandarlo al cliente bisognava
 *  comunque selezionarlo a mano. Qui resta su una riga sola e il lavoro vero
 *  lo fa il bottone. */
export function LinkOfferta({ url }: { url: string }) {
  const [copiato, setCopiato] = useState(false);

  async function copia() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      /* clipboard negata: restano il testo e il link "Apri" */
    }
  }

  return (
    <div className="mt-2">
      <div className="truncate rounded-[10px] bg-white px-2.5 py-1.5 text-[11px] font-medium text-navy/70" title={url}>
        {url}
      </div>
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={copia}
          className="rounded-full border border-[#C9881F]/40 bg-white px-3 py-1 font-display text-[11px] font-bold text-[#C9881F]"
        >
          {copiato ? "Copiato ✓" : "Copia link"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[#C9881F]/40 bg-white px-3 py-1 font-display text-[11px] font-bold text-[#C9881F]"
        >
          Apri ↗
        </a>
      </div>
    </div>
  );
}
