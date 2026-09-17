"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { submitLead, type LeadFormState } from "@/lib/actions/leads";
import { useZona } from "./ZonaContext";

/** Il form della home: due campi e una spunta.
 *
 *  Perché non chiede il nome
 *  -------------------------
 *  Perché ogni campo in più è gente che non compila, e il nome lo chiediamo
 *  comunque nella telefonata di verifica, che c'è sempre — la copertura la
 *  confermiamo a voce. Quello che serve subito è **come richiamarti**: email e
 *  telefono. (`leads.full_name` è diventata facoltativa con la migration 0072.)
 *
 *  Perché il verdetto sta qui e non nell'hero
 *  ------------------------------------------
 *  Perché è il momento in cui serve: «siamo nella tua zona» sopra un form vuoto
 *  è un invito a compilarlo. Lo stesso messaggio in cima, con il form tre
 *  schermate più giù, è una notizia che si perde per strada.
 */

const campo =
  "min-h-[52px] w-full rounded-[14px] border border-line bg-ice pl-11 pr-4 text-base font-semibold text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-blue";

function Invia() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[40px] bg-grad px-7 font-display text-base font-extrabold text-white shadow-[var(--shadow-cy)] transition-all hover:brightness-105 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? "Invio in corso…" : "Richiedi disponibilità"}
    </button>
  );
}

const IconaMail = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="m3 6.5 9 6.5 9-6.5" />
  </svg>
);

const IconaTel = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4 6.2 2 2 0 0 1 6 4z" />
  </svg>
);

export function RichiestaZona() {
  const { cap, setCap, esito } = useZona();
  const [state, formAction] = useActionState<LeadFormState, FormData>(submitLead, { error: null });
  // Gli UTM li legge il browser dopo il montaggio, non il server.
  //
  // Leggerli lato server renderebbe dinamica tutta la home — la pagina più
  // visitata e la prima che apre un crawler — per tre valori che servono solo
  // qui. `useSearchParams` li darebbe subito ma obbligherebbe a un <Suspense>,
  // e il form finirebbe fuori dall'HTML generato: chi arriva vedrebbe un buco
  // finché la pagina non si anima, e un motore di ricerca non lo vedrebbe
  // affatto. Su una pagina che esiste per raccogliere contatti è il difetto
  // peggiore dei tre.
  //
  // Finiscono in campi nascosti letti al momento dell'invio: riempirli un
  // istante dopo il primo disegno non cambia nulla per chi compila.
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setUtm({
      source: q.get("utm_source") ?? "",
      medium: q.get("utm_medium") ?? "",
      campaign: q.get("utm_campaign") ?? "",
    });
  }, []);

  // Tre stati, tre messaggi diversi. Il terzo — nessun CAP ancora scritto — non
  // è un caso limite: è chi scorre la pagina senza passare dal riquadro in alto,
  // e trovare un form senza spiegazione è il modo più veloce di perderlo.
  const titolo =
    esito === "in-zona"
      ? "Ottimo, siamo nella tua zona."
      : esito === "fuori-zona"
        ? "Da te non passiamo ancora."
        : "Verifichiamo se passiamo da te.";
  const sottotitolo =
    esito === "in-zona"
      ? "Lasciaci due contatti: ti chiamiamo per confermare la disponibilità e i prossimi slot."
      : esito === "fuori-zona"
        ? "Lasciaci comunque i contatti: decidiamo dove aprire guardando da dove ci scrivono, e ti avvisiamo appena arriviamo."
        : "Scrivi il tuo CAP e lasciaci due contatti: ti diciamo noi come siamo messi nella tua zona.";

  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        {esito === "in-zona" && (
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#1F8A5B]/12 text-[#1F8A5B]">
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12.5 9.5 18 20 6.5" />
            </svg>
          </div>
        )}
        <h2 className="font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">{titolo}</h2>
        <p className="mx-auto mt-3 max-w-md text-base font-medium leading-relaxed text-muted">{sottotitolo}</p>
      </div>

      <form action={formAction} className="mt-8 rounded-[24px] border border-line bg-white p-6 shadow-[var(--shadow-md)] sm:p-8">
        {/* Honeypot: invisibile agli umani, irresistibile per i bot. */}
        <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
          <label htmlFor="home-azienda">Azienda</label>
          <input id="home-azienda" name="azienda" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <input type="hidden" name="utm_source" value={utm.source} />
        <input type="hidden" name="utm_medium" value={utm.medium} />
        <input type="hidden" name="utm_campaign" value={utm.campaign} />

        <div className="space-y-3.5">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue"><IconaMail /></span>
            <label htmlFor="home-email" className="sr-only">La tua email</label>
            <input id="home-email" name="email" type="email" required autoComplete="email" placeholder="La tua email" className={campo} />
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue"><IconaTel /></span>
            <label htmlFor="home-phone" className="sr-only">Il tuo cellulare</label>
            <input id="home-phone" name="phone" type="tel" required inputMode="tel" autoComplete="tel" placeholder="Il tuo cellulare" className={campo} />
          </div>

          {/* Il CAP arriva dal riquadro in alto ed è modificabile qui: chi
              scorre senza passare di là lo scrive adesso, chi si è sbagliato lo
              corregge senza risalire la pagina. */}
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.4" />
              </svg>
            </span>
            <label htmlFor="home-cap" className="sr-only">Il tuo CAP</label>
            <input
              id="home-cap"
              name="cap"
              type="text"
              required
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              pattern="\d{5}"
              placeholder="Il tuo CAP"
              value={cap}
              onChange={(e) => setCap(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className={campo}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 pt-1 text-sm font-medium leading-relaxed text-muted">
            <input type="checkbox" name="privacy" required className="mt-0.5 h-5 w-5 flex-none accent-[#00c8f0]" />
            <span>
              Ho letto la{" "}
              <Link href="/privacy" className="font-bold text-blue underline">Privacy Policy</Link>{" "}
              e acconsento al trattamento dei miei dati per essere ricontattato sulla disponibilità del servizio.
            </span>
          </label>

          {state.error && (
            <p role="alert" aria-live="polite" className="rounded-[12px] bg-[#C0392B]/10 px-4 py-3 text-sm font-semibold text-[#C0392B]">
              {state.error}
            </p>
          )}

          <Invia />
          <p className="text-center text-xs font-semibold text-muted">
            Ti ricontattiamo per confermare disponibilità e prossimi slot.
          </p>
        </div>
      </form>
    </div>
  );
}
