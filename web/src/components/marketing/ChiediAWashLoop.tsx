"use client";

import { useState } from "react";

/** «Chiedi a WashLoop»: badge fisso in basso a destra, sempre a portata.
 *
 *  Non è una chat: una domanda, una risposta, e si chiude. È voluto — una chat
 *  invita a raccontare il proprio caso (nome, indirizzo, numero d'ordine), e
 *  quei dati non devono arrivare qui: l'assistente risponde solo dalle FAQ e
 *  non vede gli ordini di nessuno.
 *
 *  Chiuso è una pillola piccola; aperto è un riquadro che non copre la pagina.
 *  Sotto il livello del banner cookie (z-[60]), che deve restare sopra tutto. */
export function ChiediAWashLoop({ offsetBasso = false }: { offsetBasso?: boolean }) {
  const [aperto, setAperto] = useState(false);
  const [domanda, setDomanda] = useState("");
  const [risposta, setRisposta] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function chiedi(e: React.FormEvent) {
    e.preventDefault();
    if (domanda.trim().length < 3 || inCorso) return;
    setInCorso(true);
    setRisposta(null);
    setErrore(null);
    try {
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domanda }),
      });
      const d = (await r.json()) as { risposta?: string; errore?: string };
      if (d.risposta) setRisposta(d.risposta);
      else setErrore(d.errore ?? "Non riesco a rispondere adesso.");
    } catch {
      setErrore("Connessione assente. Riprova, oppure scrivici a info@washloop.it.");
    } finally {
      setInCorso(false);
    }
  }

  function nuovaDomanda() {
    setDomanda("");
    setRisposta(null);
    setErrore(null);
  }

  // Nell'area cliente la barra di navigazione sta in basso: il badge va alzato,
  // altrimenti ci finisce sopra.
  const basso = offsetBasso ? "bottom-24 sm:bottom-6" : "bottom-5";

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        aria-label="Chiedi a WashLoop"
        className={`fixed ${basso} right-4 z-40 inline-flex items-center gap-2 rounded-full bg-navy px-4 py-3 font-display text-sm font-extrabold text-white shadow-[0_14px_34px_-14px_rgba(27,45,94,0.8)] transition-transform hover:scale-105`}
      >
        <span aria-hidden>💬</span>
        <span className="hidden sm:inline">Domande?</span>
        <span className="sm:hidden">Aiuto</span>
      </button>
    );
  }

  return (
    <div className={`fixed ${basso} right-4 z-40 w-[min(92vw,380px)] rounded-[22px] border border-line bg-white p-4 shadow-[0_24px_60px_-20px_rgba(27,45,94,0.45)]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-sm font-extrabold text-navy">Chiedi a WashLoop</div>
          <p className="text-xs font-medium text-muted">Rispondiamo sulle domande più comuni.</p>
        </div>
        <button
          type="button"
          onClick={() => setAperto(false)}
          aria-label="Chiudi"
          className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ice font-display text-sm font-bold text-navy"
        >
          ✕
        </button>
      </div>

      {risposta ? (
        <>
          <p className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line rounded-[14px] bg-ice p-3 text-sm font-medium leading-relaxed text-navy">
            {risposta}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={nuovaDomanda}
              className="rounded-full border-2 border-navy/20 px-4 py-2 font-display text-xs font-bold text-navy"
            >
              Un&apos;altra domanda
            </button>
            <a href="mailto:info@washloop.it" className="font-display text-xs font-bold text-blue hover:underline">
              Scrivi a una persona
            </a>
          </div>
        </>
      ) : (
        <form onSubmit={chiedi} className="mt-3">
          <input
            value={domanda}
            onChange={(e) => setDomanda(e.target.value)}
            maxLength={500}
            autoFocus
            placeholder="Es. posso mettere in pausa ad agosto?"
            className="h-11 w-full rounded-[14px] border-2 border-line bg-white px-3.5 text-sm font-semibold text-navy outline-none focus:border-cyan"
          />
          <button
            type="submit"
            disabled={inCorso || domanda.trim().length < 3}
            className="mt-2 w-full rounded-full bg-gradient-to-br from-blue to-cyan py-2.5 font-display text-sm font-extrabold text-white disabled:opacity-50"
          >
            {inCorso ? "Sto leggendo…" : "Chiedi"}
          </button>
        </form>
      )}

      {errore && <p className="mt-2 text-xs font-semibold text-[#C9881F]">{errore}</p>}

      <p className="mt-3 text-[11px] font-medium leading-snug text-muted">
        Risposta automatica generata con l&apos;AI dalle nostre FAQ. Non vede i tuoi ordini e non conserviamo la conversazione.{" "}
        <a href="/privacy" className="underline">Come trattiamo i dati</a>.
      </p>
    </div>
  );
}
