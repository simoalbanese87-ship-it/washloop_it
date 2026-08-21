"use client";

import { useState } from "react";

/** «Chiedi a WashLoop»: risponde dalle FAQ, e solo da quelle.
 *
 *  Sotto la risposta c'è sempre l'invito a scriverci: l'assistente copre le
 *  domande ricorrenti, non i casi particolari — e chi ha un problema vero deve
 *  trovare una persona, non un riquadro che insiste. */
export function ChiediAWashLoop() {
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

  return (
    <div className="rounded-[22px] border border-line bg-ice/60 p-5">
      <div className="font-display text-base font-extrabold text-navy">Hai un&apos;altra domanda?</div>
      <p className="mt-1 text-sm font-medium text-muted">
        Scrivila qui: rispondiamo con le informazioni ufficiali del servizio.
      </p>

      <form onSubmit={chiedi} className="mt-3 flex flex-wrap gap-2">
        <input
          value={domanda}
          onChange={(e) => setDomanda(e.target.value)}
          maxLength={500}
          placeholder="Es. posso mettere in pausa ad agosto?"
          className="h-12 min-w-[240px] flex-1 rounded-[16px] border-2 border-line bg-white px-4 text-sm font-semibold text-navy outline-none focus:border-cyan"
        />
        <button
          type="submit"
          disabled={inCorso || domanda.trim().length < 3}
          className="rounded-full bg-gradient-to-br from-blue to-cyan px-6 py-3 font-display text-sm font-extrabold text-white disabled:opacity-50"
        >
          {inCorso ? "Sto leggendo…" : "Chiedi"}
        </button>
      </form>

      {risposta && (
        <div className="mt-3 rounded-[16px] border border-line bg-white p-4">
          <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-navy">{risposta}</p>
          <p className="mt-2 text-xs font-medium text-muted">
            Risposta automatica basata sulle nostre FAQ. Per il tuo caso specifico scrivi a{" "}
            <a href="mailto:info@washloop.it" className="font-bold text-blue underline">info@washloop.it</a>.
          </p>
        </div>
      )}

      {errore && <p className="mt-3 text-sm font-semibold text-[#C9881F]">{errore}</p>}
    </div>
  );
}
