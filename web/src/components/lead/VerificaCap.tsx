"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { submitLead, type LeadFormState } from "@/lib/actions/leads";
import { esitoCap, formatoCapValido, type EsitoCap } from "@/lib/copertura";

/** Campo CAP che apre la richiesta lì dove sei.
 *
 *  Il difetto che toglie
 *  ---------------------
 *  Sulle pagine di servizio il bottone «Controlla se copriamo il tuo CAP»
 *  portava su un'altra pagina, dove si scriveva il CAP, si premeva «Verifica
 *  disponibilità»… e comparivano di nuovo le stesse parole su un secondo
 *  bottone. Due pagine e due volte la stessa domanda per un'informazione che
 *  sappiamo dare in un istante: chi legge pensa di aver sbagliato qualcosa, e a
 *  quel punto se ne va.
 *
 *  Qui il CAP si scrive dove si sta leggendo, la risposta arriva subito in una
 *  finestra, e nella stessa finestra si lasciano i contatti. Nessun salto di
 *  pagina finché non c'è qualcosa da confermare.
 *
 *  Perché `<dialog>` e non un div
 *  ------------------------------
 *  Perché lo sa fare il browser: sfondo inerte, Esc che chiude, il ritorno del
 *  fuoco a chi l'ha aperta. Rifarlo a mano significa rifarlo peggio, e quasi
 *  sempre dimenticarsi la tastiera.
 */

const campo =
  "min-h-[52px] w-full rounded-[14px] border border-line bg-ice pl-11 pr-4 text-base font-semibold text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-blue";

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
const IconaLuogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

function Invia() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[40px] bg-grad px-7 font-display text-base font-extrabold text-white shadow-[var(--shadow-cy)] transition-all hover:brightness-105 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? "Invio in corso…" : "Mandami le informazioni"}
    </button>
  );
}

export function VerificaCap() {
  const [cap, setCap] = useState("");
  const [toccato, setToccato] = useState(false);
  const [esito, setEsito] = useState<EsitoCap | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState<LeadFormState, FormData>(submitLead, { error: null });

  const valido = formatoCapValido(cap);

  function apri(e: React.FormEvent) {
    e.preventDefault();
    setToccato(true);
    if (!valido) return;
    setEsito(esitoCap(cap));
    dialog.current?.showModal();
  }

  /** Gli UTM si leggono qui, dall'indirizzo della pagina, e non da uno stato:
   *  servono solo al momento dell'invio e leggerli prima obbligherebbe a tenerli
   *  da qualche parte senza motivo. */
  function inviaConUtm(fd: FormData) {
    const q = new URLSearchParams(window.location.search);
    for (const k of ["utm_source", "utm_medium", "utm_campaign"]) fd.set(k, q.get(k) ?? "");
    return formAction(fd);
  }

  const inZona = esito === "in-zona";

  return (
    <>
      {/* Lo stesso riquadro bianco della home, e non è pigrizia: il campo e il
          bottone affiancati dentro una pillola trasparente lasciavano un vuoto
          largo fra il testo scritto e il tasto, e quel vuoto legge come un
          pezzo di interfaccia non finito. In colonna dentro una scheda bianca
          il campo è un campo, il tasto è un tasto, e il riquadro stacca dal
          fondo navy invece di sparirci dentro. */}
      <form onSubmit={apri} noValidate className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-[var(--shadow-md)]">
        <label htmlFor="verifica-cap" className="mb-2 flex items-center gap-1.5 font-display text-xs font-extrabold uppercase tracking-[0.14em] text-navy/50">
          <IconaLuogo size={14} />
          Il tuo CAP
        </label>
        <input
          id="verifica-cap"
          name="cap"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          placeholder="Es. 20143"
          value={cap}
          onChange={(e) => {
            setCap(e.target.value.replace(/\D/g, "").slice(0, 5));
            setToccato(false);
          }}
          aria-invalid={toccato && !valido ? true : undefined}
          aria-describedby={toccato && !valido ? "verifica-cap-errore" : undefined}
          className="min-h-[52px] w-full rounded-[14px] border border-line bg-ice px-4 font-display text-lg font-extrabold text-navy outline-none transition-colors placeholder:font-semibold placeholder:text-navy/30 focus:border-blue"
        />
        {/* L'errore compare dopo un tentativo, non a ogni cifra digitata. */}
        {toccato && !valido && (
          <p id="verifica-cap-errore" role="alert" className="mt-2 text-sm font-semibold text-[#C0392B]">
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

      <dialog
        ref={dialog}
        // Il clic sullo sfondo chiude: è il gesto che tutti provano per primo.
        // Il confronto su `currentTarget` distingue lo sfondo dal contenuto —
        // senza, chiudeva anche cliccando dentro il modulo.
        onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}
        className="w-[calc(100vw-2rem)] max-w-md rounded-[24px] border border-line bg-white p-0 text-navy shadow-[var(--shadow-md)] backdrop:bg-navy/70 backdrop:backdrop-blur-sm"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div
              className={`flex h-12 w-12 flex-none items-center justify-center rounded-full ${
                inZona ? "bg-[#1F8A5B]/12 text-[#1F8A5B]" : "bg-[#C9881F]/12 text-[#C9881F]"
              }`}
            >
              {inZona ? (
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 12.5 9.5 18 20 6.5" />
                </svg>
              ) : (
                <IconaLuogo size={24} />
              )}
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Chiudi"
              className="-mr-1 -mt-1 grid h-9 w-9 flex-none place-items-center rounded-full text-navy/40 transition-colors hover:bg-ice hover:text-navy"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <h2 className="mt-4 font-display text-2xl font-black tracking-[-0.02em] text-navy">
            {inZona ? `Il CAP ${cap} è coperto.` : `Da ${cap} non passiamo ancora.`}
          </h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-muted">
            {inZona
              ? "Lasciaci un contatto e ti mandiamo tutte le informazioni: come funziona, quanto costa e i prossimi slot disponibili."
              : "Lasciaci comunque un contatto: decidiamo dove aprire guardando da dove ci scrivono, e ti avvisiamo appena arriviamo nella tua zona."}
          </p>

          <form action={inviaConUtm} className="mt-6 space-y-3.5">
            {/* Honeypot: invisibile agli umani, irresistibile per i bot. */}
            <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
              <label htmlFor="vc-azienda">Azienda</label>
              <input id="vc-azienda" name="azienda" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            {/* Il CAP è quello appena verificato: chiederlo di nuovo qui sarebbe
                la ripetizione da cui questa finestra esiste per uscire. */}
            <input type="hidden" name="cap" value={cap} />

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue"><IconaMail /></span>
              <label htmlFor="vc-email" className="sr-only">La tua email</label>
              <input id="vc-email" name="email" type="email" required autoComplete="email" placeholder="La tua email" className={campo} />
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue"><IconaTel /></span>
              <label htmlFor="vc-phone" className="sr-only">Il tuo cellulare</label>
              <input id="vc-phone" name="phone" type="tel" required inputMode="tel" autoComplete="tel" placeholder="Il tuo cellulare" className={campo} />
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
          </form>
        </div>
      </dialog>
    </>
  );
}
