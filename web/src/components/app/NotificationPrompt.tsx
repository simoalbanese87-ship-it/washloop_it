"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "wl_notif_prompt";
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function subscribe(): Promise<boolean> {
  if (!VAPID || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource }));
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Popup basso (solo /app) che chiede di abilitare le notifiche push.
 *  Non ricompare se il permesso è già stato concesso/negato o se chiuso. */
export function NotificationPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = Notification.permission;
    if (perm === "granted") {
      // Già concesso: assicura che l'iscrizione sia salvata, niente popup.
      void subscribe();
      return;
    }
    if (perm === "denied") return; // non richiedere più
    if (localStorage.getItem(DISMISS_KEY)) return; // già chiuso
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  async function enable() {
    setShow(false);
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") await subscribe();
      else localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* no-op */
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-[92px] z-[55] mx-auto max-w-[460px] px-4">
      <div className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-4 shadow-[0_12px_40px_-12px_rgba(27,45,94,0.4)]">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-ice text-xl">🔔</span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-extrabold text-navy">Attiva le notifiche</div>
          <div className="text-xs font-medium text-muted">Ti avvisiamo a ogni passaggio del tuo bucato.</div>
        </div>
        <div className="flex flex-none flex-col gap-1.5">
          <button onClick={enable} className="rounded-full bg-gradient-to-br from-blue to-cyan px-4 py-1.5 font-display text-xs font-extrabold text-white">Attiva</button>
          <button onClick={dismiss} className="font-display text-[11px] font-bold text-muted">Più tardi</button>
        </div>
      </div>
    </div>
  );
}
