"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "wl_install_banner";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as { standalone?: boolean }).standalone === true;
}

/** Banner alto (solo mobile, solo /app) che invita a installare la PWA.
 *  Android/Chrome: usa beforeinstallprompt. iOS: istruzioni manuali.
 *  Non compare se già installata (standalone) o se chiuso. */
export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return; // già installata → non chiedere
    if (localStorage.getItem(DISMISS_KEY)) return; // già chiuso
    const mobile = window.matchMedia("(max-width: 768px)").matches || window.matchMedia("(pointer: coarse)").matches;
    if (!mobile) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS Safari non emette beforeinstallprompt → mostra istruzioni
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIOS) {
      setIos(true);
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => {});
      dismiss();
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mx-auto mb-2 flex max-w-[460px] items-center gap-3 rounded-[18px] border border-line bg-white px-4 py-3 shadow-[0_8px_24px_-12px_rgba(27,45,94,0.35)]">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-gradient-to-br from-blue to-cyan text-base text-white">⬇️</span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[13px] font-extrabold text-navy">Installa WashLoop</div>
        <div className="text-[11px] font-medium text-muted">
          {ios ? "Tocca Condividi → «Aggiungi a schermata Home»" : "Aggiungila alla schermata Home in un tap."}
        </div>
      </div>
      {!ios && (
        <button onClick={install} className="flex-none rounded-full bg-gradient-to-br from-blue to-cyan px-4 py-1.5 font-display text-xs font-extrabold text-white">
          Installa
        </button>
      )}
      <button onClick={dismiss} aria-label="Chiudi" className="flex-none text-navy/40">
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );
}
