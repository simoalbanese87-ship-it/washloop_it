"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE = "wl_cookie_consent";

/** Banner cookie. WashLoop usa solo cookie tecnici/necessari → informativa
 *  con presa visione (non blocca la navigazione). Se in futuro si aggiungono
 *  cookie non essenziali, qui va aggiunta la gestione del consenso granulare. */
export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`));
    if (!seen) setShow(true);
  }, []);

  function accept() {
    document.cookie = `${COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 180}; SameSite=Lax`;
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-[20px] border border-line bg-white p-5 shadow-[0_12px_40px_rgba(11,31,58,0.18)] sm:flex-row sm:items-center sm:gap-5">
        <p className="flex-1 text-sm font-medium leading-relaxed text-navy/75">
          Usiamo solo <strong>cookie tecnici necessari</strong> al funzionamento del sito (accesso e pagamenti). Nessun
          cookie di profilazione.{" "}
          <Link href="/cookie" className="font-bold text-blue hover:underline">
            Cookie Policy
          </Link>
        </p>
        <button
          onClick={accept}
          className="shrink-0 rounded-[40px] bg-navy px-6 py-3 font-display text-sm font-extrabold text-cyan transition-all hover:-translate-y-0.5"
        >
          Ho capito
        </button>
      </div>
    </div>
  );
}
