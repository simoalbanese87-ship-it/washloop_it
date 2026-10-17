"use client";

import { useEffect, useRef, useState } from "react";
import { apriChat, chatDisponibile, quandoChatSiChiude, type ChiScrive } from "@/lib/chat-brevo";

/** «Domande?»: il badge fisso in basso a destra, e dentro due strade.
 *
 *  Le domande che arrivano da qui sono di due specie, e dal 15 ottobre 2026 si
 *  separano al primo clic:
 *
 *  - **Risposta subito** — l'assistente sulle FAQ, che c'era già. Una domanda,
 *    una risposta, niente conversazione: non vede gli ordini di nessuno, e
 *    quindi non si deve raccontargli il proprio caso.
 *  - **Scrivi a noi** — la chat Brevo, dove risponde una persona. Si carica
 *    **solo premendo** (vedi `lib/chat-brevo.ts`): nessun cookie di terze parti
 *    a chi passa di qui e non ci scriverà mai, e una bollicina sola in
 *    quell'angolo invece di due sovrapposte.
 *
 *  Chiuso è una pillola piccola; aperto è un riquadro che non copre la pagina.
 *  Sotto il livello del banner cookie (z-[60]), che deve restare sopra tutto. */
export function ChiediAWashLoop({ offsetBasso = false, chi }: { offsetBasso?: boolean; chi?: ChiScrive }) {
  const [aperto, setAperto] = useState(false);
  // Il bivio è il primo schermo: `false` finché non si sceglie l'assistente.
  const [assistente, setAssistente] = useState(false);
  const [chatRotta, setChatRotta] = useState(false);
  // Chat Brevo aperta: la nostra pillola si toglie di mezzo.
  const [inChat, setInChat] = useState(false);
  const [domanda, setDomanda] = useState("");
  // La conversazione, non una domanda sola.
  //
  // Prima ogni domanda era la prima: chi chiedeva «e per il solo stiro?» dopo
  // una risposta sui prezzi non veniva capito, e doveva riscrivere tutto. I
  // turni si mandano al server a ogni domanda — lì vengono ripuliti, perché
  // arrivano dal browser e di quello che arriva dal browser non ci si fida.
  const [turni, setTurni] = useState<{ ruolo: "utente" | "assistente"; testo: string }[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  // La conversazione scorre dentro un riquadro alto poco più di un dito: senza
  // questo, la risposta nuova nasce sotto il bordo e sembra che non sia
  // arrivata — chi scrive riprova, e la seconda domanda sembra ignorata.
  const fondo = useRef<HTMLDivElement | null>(null);

  async function chiedi(e: React.FormEvent) {
    e.preventDefault();
    const testo = domanda.trim();
    if (testo.length < 3 || inCorso) return;
    setInCorso(true);
    setErrore(null);
    // La domanda compare subito in conversazione: chi scrive deve vedere che
    // è stata presa, anche se la risposta ci mette due secondi.
    const storico = turni;
    setTurni([...storico, { ruolo: "utente", testo }]);
    setDomanda("");
    try {
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domanda: testo, storico }),
      });
      const d = (await r.json()) as { risposta?: string; errore?: string };
      if (d.risposta) setTurni((t) => [...t, { ruolo: "assistente", testo: d.risposta! }]);
      else setErrore(d.errore ?? "Non riesco a rispondere adesso.");
    } catch {
      setErrore("Connessione assente. Riprova, oppure scrivici a info@washloop.it.");
    } finally {
      setInCorso(false);
    }
  }

  useEffect(() => {
    fondo.current?.scrollIntoView({ block: "end" });
  }, [turni, inCorso]);

  function nuovaDomanda() {
    setDomanda("");
    setTurni([]);
    setErrore(null);
  }

  function chiudi() {
    setAperto(false);
    // Alla riapertura si riparte dal bivio: la scelta di prima era per quella
    // domanda lì, non per sempre.
    setAssistente(false);
    nuovaDomanda();
  }

  function scriviANoi() {
    if (!apriChat(chi)) {
      setChatRotta(true);
      return;
    }
    // Mentre la conversazione è aperta la nostra pillola sparisce: resterebbe
    // sopra il campo dove si scrive, nello stesso angolo. Torna da sola quando
    // la chat si chiude.
    setAperto(false);
    setInChat(true);
    quandoChatSiChiude(() => setInChat(false));
  }

  // Nell'area cliente la barra di navigazione sta in basso: il badge va alzato,
  // altrimenti ci finisce sopra.
  const basso = offsetBasso ? "bottom-24 sm:bottom-6" : "bottom-5";

  if (inChat) return null;

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
          <div className="font-display text-sm font-extrabold text-navy">
            {assistente ? "Chiedi a WashLoop" : "Come preferisci?"}
          </div>
          <p className="text-xs font-medium text-muted">
            {assistente ? "Rispondiamo sulle domande più comuni." : "Due strade: una risponde adesso, l'altra è una persona."}
          </p>
        </div>
        <button
          type="button"
          onClick={chiudi}
          aria-label="Chiudi"
          className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ice font-display text-sm font-bold text-navy"
        >
          ✕
        </button>
      </div>

      {!assistente ? (
        <div className="mt-3 space-y-2">
          {/* La prima strada: risposta immediata, ma automatica. Si dice cosa
              aspettarsi prima di sceglierla, perché «chat» e «risposta
              automatica» promettono due cose diverse. */}
          <button
            type="button"
            onClick={() => setAssistente(true)}
            className="flex w-full items-start gap-3 rounded-[16px] border-2 border-line bg-white p-3 text-left transition-colors hover:border-cyan"
          >
            <span aria-hidden className="text-lg leading-none">⚡</span>
            <span>
              <span className="block font-display text-sm font-extrabold text-navy">Risposta subito</span>
              <span className="block text-xs font-medium leading-snug text-muted">
                Prezzi, zone, come funziona. Risponde l&apos;assistente, in pochi secondi.
              </span>
            </span>
          </button>

          {/* La seconda: una persona. Niente promesse sui tempi — «ti
              rispondiamo in 2 minuti» è la frase che fa arrabbiare chi aspetta
              dieci. */}
          {chatDisponibile() && (
            <button
              type="button"
              onClick={scriviANoi}
              className="flex w-full items-start gap-3 rounded-[16px] border-2 border-line bg-white p-3 text-left transition-colors hover:border-cyan"
            >
              <span aria-hidden className="text-lg leading-none">💬</span>
              <span>
                <span className="block font-display text-sm font-extrabold text-navy">Scrivi a noi</span>
                <span className="block text-xs font-medium leading-snug text-muted">
                  Il tuo ordine, un ritiro da spostare, un problema. Ti risponde una persona.
                </span>
              </span>
            </button>
          )}

          {/* Terza via, che non è una scelta ma un ripiego: se la chat non
              parte (un blocco, un'estensione, la rete) resta un indirizzo
              scritto, invece di un bottone che non fa niente. */}
          {(!chatDisponibile() || chatRotta) && (
            <a
              href="mailto:info@washloop.it"
              className="flex w-full items-start gap-3 rounded-[16px] border-2 border-line bg-white p-3 text-left transition-colors hover:border-cyan"
            >
              <span aria-hidden className="text-lg leading-none">✉️</span>
              <span>
                <span className="block font-display text-sm font-extrabold text-navy">Scrivici per email</span>
                <span className="block text-xs font-medium leading-snug text-muted">info@washloop.it</span>
              </span>
            </a>
          )}
        </div>
      ) : (
        <>
          {/* La conversazione. Prima qui c'era una risposta sola che spariva
              alla domanda dopo: chi voleva chiedere un dettaglio in più doveva
              ricominciare, e spesso riscriveva anche la prima domanda. */}
          {turni.length > 0 && (
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {turni.map((t, i) => (
                <p
                  key={i}
                  className={
                    t.ruolo === "utente"
                      ? "ml-8 rounded-[14px] bg-blue/10 p-2.5 text-sm font-semibold text-navy"
                      : "mr-4 whitespace-pre-line rounded-[14px] bg-ice p-3 text-sm font-medium leading-relaxed text-navy"
                  }
                >
                  {t.testo}
                </p>
              ))}
              {inCorso && <p className="mr-4 rounded-[14px] bg-ice p-3 text-sm font-medium text-muted">Sto leggendo…</p>}
              <div ref={fondo} />
            </div>
          )}

          <form onSubmit={chiedi} className="mt-3">
            <input
              value={domanda}
              onChange={(e) => setDomanda(e.target.value)}
              maxLength={500}
              autoFocus
              placeholder={turni.length ? "Chiedi un'altra cosa…" : "Es. posso sospendere ad agosto?"}
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

          {turni.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={nuovaDomanda}
                className="rounded-full border-2 border-navy/20 px-4 py-2 font-display text-xs font-bold text-navy"
              >
                Ricomincia
              </button>
              {/* La via d'uscita verso una persona resta a portata: quando
                  l'assistente non basta, il momento in cui si capisce è
                  esattamente questo. */}
              {chatDisponibile() ? (
                <button type="button" onClick={scriviANoi} className="font-display text-xs font-bold text-blue hover:underline">
                  Parla con una persona
                </button>
              ) : (
                <a href="mailto:info@washloop.it" className="font-display text-xs font-bold text-blue hover:underline">
                  Scrivi a una persona
                </a>
              )}
            </div>
          )}
        </>
      )}

      {errore && <p className="mt-2 text-xs font-semibold text-[#C9881F]">{errore}</p>}

      {assistente && (
        <p className="mt-3 text-[11px] font-medium leading-snug text-muted">
          Risposta automatica generata con l&apos;AI dalle nostre FAQ. Non vede i tuoi ordini. Teniamo traccia delle domande — non di chi le fa — per capire cosa manca nelle risposte.{" "}
          <a href="/privacy" className="underline">Come trattiamo i dati</a>.
        </p>
      )}
    </div>
  );
}
