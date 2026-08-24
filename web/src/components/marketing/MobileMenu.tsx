"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** Il menu del sito su schermo stretto.
 *
 *  Prima non c'era: sotto i 768px sparivano le quattro voci di navigazione e
 *  sotto i 640px spariva anche "Accedi", lasciando il solo pulsante "Attiva
 *  WashLoop". Chi non aveva installato la webapp e voleva semplicemente
 *  entrare nel proprio account non aveva nessuna strada dall'header — doveva
 *  scorrere fino in fondo alla pagina e trovare il link nel footer.
 *
 *  Ogni voce chiude il pannello quando la si tocca: le voci puntano ad ancore
 *  della stessa pagina, e restare aperti sopra il contenuto appena raggiunto
 *  sarebbe fastidioso. */
export function MobileMenu({ voci }: { voci: { href: string; label: string }[] }) {
  const [aperto, setAperto] = useState(false);
  const contenitore = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aperto) return;
    const suTasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAperto(false);
    };
    const fuori = (e: MouseEvent) => {
      if (!contenitore.current?.contains(e.target as Node)) setAperto(false);
    };
    document.addEventListener("keydown", suTasto);
    document.addEventListener("mousedown", fuori);
    return () => {
      document.removeEventListener("keydown", suTasto);
      document.removeEventListener("mousedown", fuori);
    };
  }, [aperto]);

  return (
    <div ref={contenitore} className="md:hidden">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto}
        aria-controls="menu-sito"
        aria-label={aperto ? "Chiudi il menu" : "Apri il menu"}
        className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-navy transition-colors hover:bg-ice"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          {aperto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {aperto && (
        <div
          id="menu-sito"
          className="absolute inset-x-0 top-16 border-b border-line bg-white/98 px-5 pb-5 pt-2 shadow-[0_18px_40px_-24px_rgba(27,45,94,0.5)] backdrop-blur-md"
        >
          <nav className="flex flex-col">
            {voci.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAperto(false)}
                className="border-b border-line/70 py-3 font-display text-base font-bold text-navy"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setAperto(false)}
              className="py-3 font-display text-base font-bold text-blue"
            >
              Accedi al mio account →
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
