"use client";

import { useRef, useState } from "react";

/** Il link di pagamento di una proposta aperta: si copia, non si legge.
 *
 *  Mostrato per intero occupava metà della colonna con duecento caratteri di
 *  URL Stripe che nessuno leggerà mai — e per mandarlo al cliente bisognava
 *  comunque selezionarlo a mano. Qui resta su una riga e il lavoro lo fa il
 *  bottone.
 *
 *  **Il caso in cui la copia non riesce va mostrato.** `navigator.clipboard`
 *  fallisce in parecchie situazioni normali (pagina senza fuoco, permesso
 *  negato, browser vecchio) e prima l'errore veniva ingoiato in silenzio: si
 *  premeva il bottone e non succedeva niente, senza sapere se il link fosse
 *  finito negli appunti o no — col rischio di incollare al cliente qualcos'altro.
 *  Ora, se non riesce, il link si apre per intero già selezionato e lo dice. */
export function LinkOfferta({ url }: { url: string }) {
  const [stato, setStato] = useState<"pronto" | "copiato" | "a-mano">("pronto");
  const testo = useRef<HTMLDivElement>(null);

  async function copia() {
    try {
      await navigator.clipboard.writeText(url);
      setStato("copiato");
      setTimeout(() => setStato("pronto"), 2000);
    } catch {
      // Ripiego: si mostra tutto e si seleziona, così basta premere ⌘C.
      setStato("a-mano");
      requestAnimationFrame(() => {
        const nodo = testo.current;
        if (!nodo) return;
        const range = document.createRange();
        range.selectNodeContents(nodo);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
    }
  }

  const aMano = stato === "a-mano";

  return (
    <div className="mt-2">
      <div
        ref={testo}
        className={`rounded-[10px] bg-white px-2.5 py-1.5 text-[11px] font-medium text-navy/70 ${aMano ? "break-all select-all" : "truncate"}`}
        title={url}
      >
        {url}
      </div>

      {aMano ? (
        <p className="mt-1.5 text-[11px] font-bold text-[#C9881F]">
          Il browser non mi lascia usare gli appunti: il link è qui sopra, già selezionato — copialo con ⌘C.
        </p>
      ) : (
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={copia}
            className="rounded-full border border-[#C9881F]/40 bg-white px-3 py-1 font-display text-[11px] font-bold text-[#C9881F]"
          >
            {stato === "copiato" ? "Copiato ✓" : "Copia link"}
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
      )}
    </div>
  );
}
