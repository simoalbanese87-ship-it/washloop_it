"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE = "wl_cookie_consent";
// v2: dall'introduzione del pixel Meta il sito usa anche cookie pubblicitari,
// quindi il consenso raccolto sulla v1 non è più valido e va richiesto di nuovo.
const VERSION = "2";
export const COOKIE_PREFS_EVENT = "wl:open-cookie-prefs";
/** Emesso quando l'utente sceglie: gli script non essenziali si attivano o
 *  restano spenti senza bisogno di ricaricare la pagina. */
export const CONSENT_CHANGED_EVENT = "wl:consent-changed";

type Consent = "all" | "essential";

function setConsent(value: Consent) {
  // Salva scelta + versione; 6 mesi.
  document.cookie = `${COOKIE}=${value}.${VERSION}; path=/; max-age=${60 * 60 * 24 * 180}; SameSite=Lax`;
}

function currentConsent(): string | null {
  const row = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  return row ? row.split("=")[1] : null;
}

/** True solo con "Accetta tutti" sulla versione corrente del banner.
 *  In assenza di scelta il default è NO: nessuno script di marketing parte. */
export function hasMarketingConsent(): boolean {
  return currentConsent() === `all.${VERSION}`;
}

/** Banner cookie GDPR. I cookie tecnici sono sempre attivi; misurazione e
 *  pubblicità (pixel Meta) SOLO con "Accetta tutti". "Solo necessari" rifiuta
 *  tutto il resto. Le due scelte hanno pari evidenza (linee guida Garante).
 *  Riapribile da "Preferenze cookie". */
export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const c = currentConsent();
    if (!c || !c.endsWith(`.${VERSION}`)) setShow(true);
    const open = () => setShow(true);
    window.addEventListener(COOKIE_PREFS_EVENT, open);
    return () => window.removeEventListener(COOKIE_PREFS_EVENT, open);
  }, []);

  function choose(value: Consent) {
    setConsent(value);
    setShow(false);
    // Sveglia gli script non essenziali (es. pixel Meta) senza ricaricare.
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: value }));
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4">
      <div className="mx-auto max-w-3xl rounded-[20px] border border-line bg-white p-5 shadow-[0_12px_40px_rgba(11,31,58,0.18)]">
        <p className="text-sm font-medium leading-relaxed text-navy/75">
          Usiamo <strong>cookie tecnici necessari</strong> al funzionamento del sito (accesso e pagamenti) e, solo con il tuo
          consenso, cookie di <strong>misurazione</strong> e <strong>pubblicitari di terze parti</strong> (Meta) per mostrarti
          annunci più pertinenti.{" "}
          <Link href="/cookie" className="font-bold text-blue hover:underline">
            Cookie Policy
          </Link>
        </p>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
          <button
            onClick={() => choose("essential")}
            className="order-2 rounded-[40px] border-2 border-navy/25 px-6 py-2.5 font-display text-sm font-extrabold text-navy transition-all hover:bg-navy/5 sm:order-1"
          >
            Solo necessari
          </button>
          <button
            onClick={() => choose("all")}
            className="order-1 rounded-[40px] bg-navy px-6 py-2.5 font-display text-sm font-extrabold text-cyan transition-all hover:-translate-y-0.5 sm:order-2"
          >
            Accetta tutti
          </button>
        </div>
      </div>
    </div>
  );
}
