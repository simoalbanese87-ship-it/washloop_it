"use client";

import { COOKIE_PREFS_EVENT } from "./CookieBanner";

/** Riapre il banner di scelta cookie (richiesto per poter revocare il consenso). */
export function CookiePrefsLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(COOKIE_PREFS_EVENT))} className={className}>
      Preferenze cookie
    </button>
  );
}
