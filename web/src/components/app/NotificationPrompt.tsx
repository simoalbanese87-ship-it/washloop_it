"use client";

import { useEffect, useState } from "react";
import { attiva, iosNonInstallato, iscriviti } from "@/lib/notifiche-browser";

/** Popup basso che chiede di abilitare le notifiche push.
 *
 *  Due cose cambiate il 17 ottobre 2026, dopo aver contato tre iscrizioni in
 *  tutto il sistema:
 *
 *  1. **«Più tardi» non significa più «mai più».** Prima bastava chiuderlo una
 *     volta — anche per sbaglio, anche prima di aver capito cosa fosse — e non
 *     ricompariva nemmeno dopo mesi. Ora torna dopo una settimana. Non è
 *     insistenza: è che fra chi legge «avvisi quando il bucato è pronto» e chi
 *     ha appena finito di installare l'app passano giorni.
 *
 *  2. **Non è più l'unica strada.** `StatoNotifiche` è il riquadro stabile che
 *     dice come stanno le cose e lascia attivarle quando si vuole; qui resta il
 *     solo invito al momento giusto.
 *
 *  La logica del browser — permesso, iscrizione, trappola di iOS — sta tutta in
 *  `lib/notifiche-browser.ts`, perché serviva anche agli altri due posti. */

const DISMISS_KEY = "wl_notif_prompt";
/** Quanto si tace dopo un «più tardi». Una settimana: abbastanza per non
 *  essere molesti, abbastanza poco da ricapitare mentre il servizio è in uso. */
const SILENZIO_MS = 7 * 24 * 3600_000;

function silenziatoDiRecente(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    // Il vecchio valore era "1", senza data: vale come «chiuso tanto tempo fa»
    // e quindi non silenzia più niente.
    const quando = parseInt(v, 10);
    if (!Number.isFinite(quando) || quando <= 1) return false;
    return Date.now() - quando < SILENZIO_MS;
  } catch {
    return false;
  }
}

function silenzia() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Navigazione privata o storage pieno: pazienza, ricomparirà.
  }
}

export function NotificationPrompt({
  subtitle = "Ti avvisiamo a ogni passaggio del tuo bucato.",
  /** Dove sta il bordo basso: nell'app del cliente c'è la barra delle schede,
   *  nelle aree di lavoro no e il popup deve scendere fino in fondo. */
  sopraLaBarra = true,
}: {
  subtitle?: string;
  sopraLaBarra?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = Notification.permission;
    if (perm === "granted") {
      // Già concesso: si risalva l'iscrizione — gli endpoint push scadono — e
      // non si mostra niente.
      void iscriviti();
      return;
    }
    if (perm === "denied") return; // non si può più chiedere da qui
    if (iosNonInstallato()) return; // prima va installata, o il permesso si brucia
    if (silenziatoDiRecente()) return;
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  async function enable() {
    setShow(false);
    const esito = await attiva();
    if (esito === "attive") return;
    if (esito === "bloccate" || esito === "da-attivare") {
      silenzia();
      return;
    }
    setErrore("Non siamo riusciti ad attivare le notifiche. Riprova più tardi.");
  }

  function dismiss() {
    silenzia();
    setShow(false);
  }

  if (errore) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
        <div className="mx-auto max-w-md rounded-[18px] border border-line bg-white p-4 shadow-[var(--shadow-md)]">
          <p className="text-sm font-semibold text-[#C9881F]">{errore}</p>
          <button onClick={() => setErrore("")} className="mt-2 font-display text-xs font-bold text-navy underline">
            Chiudi
          </button>
        </div>
      </div>
    );
  }

  if (!show) return null;

  return (
    <div className={`fixed inset-x-0 z-[55] mx-auto max-w-[460px] px-4 ${sopraLaBarra ? "bottom-[92px]" : "bottom-4"}`}>
      <div className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-4 shadow-[0_12px_40px_-12px_rgba(27,45,94,0.4)]">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-ice text-xl">🔔</span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-extrabold text-navy">Attiva le notifiche</div>
          <div className="text-xs font-medium text-muted">{subtitle}</div>
        </div>
        <div className="flex flex-none flex-col gap-1.5">
          <button onClick={enable} className="rounded-full bg-gradient-to-br from-blue to-cyan px-4 py-1.5 font-display text-xs font-extrabold text-white">Attiva</button>
          <button onClick={dismiss} className="font-display text-[11px] font-bold text-muted">Più tardi</button>
        </div>
      </div>
    </div>
  );
}
