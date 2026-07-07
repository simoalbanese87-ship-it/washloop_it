"use client";

import { useEffect, useState } from "react";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function subscribePush(): Promise<boolean> {
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

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Platform = "ios-safari" | "ios-other" | "android" | "desktop";
type Perm = "default" | "granted" | "denied" | "unsupported";

const ShareIcon = () => (
  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="inline align-[-3px]">
    <path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

/** Guida persistente (pagina /app/installa): come installare la PWA sul telefono
 *  e attivare le notifiche. Rileva la piattaforma e mostra i passi giusti,
 *  con linguaggio semplice per utenti poco tecnici. */
export function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [standalone, setStandalone] = useState(false);
  const [perm, setPerm] = useState<Perm>("default");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (/mac/i.test(ua) && "ontouchend" in document);
    const isAndroid = /android/i.test(ua);
    // Safari "vero" su iOS: esclude Chrome/Firefox/Edge iOS (crios/fxios/edgios).
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|chrome/i.test(ua);
    setPlatform(isIOS ? (isSafari ? "ios-safari" : "ios-other") : isAndroid ? "android" : "desktop");

    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (window.navigator as { standalone?: boolean }).standalone === true);

    if (!("Notification" in window)) setPerm("unsupported");
    else setPerm(Notification.permission as Perm);

    const onBip = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  async function androidInstall() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
  }

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    setBusy(true);
    try {
      const p = await Notification.requestPermission();
      setPerm(p as Perm);
      if (p === "granted") await subscribePush();
    } catch { /* no-op */ } finally { setBusy(false); }
  }

  // Le notifiche su iPhone funzionano SOLO con l'app installata (iOS 16.4+).
  const iosNeedsInstallFirst = (platform === "ios-safari" || platform === "ios-other") && !standalone;

  return (
    <div className="space-y-4">
      {/* Step 1 — Installa */}
      <section className="rounded-[20px] border border-line bg-white p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-gradient-to-br from-blue to-cyan font-display text-sm font-black text-white">1</span>
          <h2 className="font-display text-lg font-black text-navy">Installa l&apos;app sul telefono</h2>
        </div>

        {standalone ? (
          <p className="mt-3 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-bold text-[#1F8A5B]">✅ Perfetto, stai già usando l&apos;app installata!</p>
        ) : platform === "ios-safari" ? (
          <>
            <p className="mt-3 text-sm font-medium text-muted">Aggiungi WashLoop alla schermata Home del tuo iPhone:</p>
            <ol className="mt-3 space-y-3">
              <Step n="A">Tocca l&apos;icona <b>Condividi</b> <ShareIcon /> in basso al centro di Safari.</Step>
              <Step n="B">Scorri e tocca <b>«Aggiungi a schermata Home»</b>.</Step>
              <Step n="C">In alto a destra tocca <b>«Aggiungi»</b>.</Step>
              <Step n="D">Chiudi Safari e apri <b>WashLoop</b> dalla nuova icona 🧺 sul telefono.</Step>
            </ol>
          </>
        ) : platform === "ios-other" ? (
          <p className="mt-3 rounded-[14px] bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">
            Su iPhone l&apos;app si installa solo da <b>Safari</b>. Apri <b>washloop.it</b> in Safari, poi torna qui e segui i passi.
          </p>
        ) : platform === "android" ? (
          <>
            <p className="mt-3 text-sm font-medium text-muted">Aggiungi WashLoop alla schermata Home:</p>
            {deferred ? (
              <button onClick={androidInstall} className="mt-3 w-full rounded-full bg-gradient-to-br from-blue to-cyan py-3.5 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
                📲 Installa WashLoop
              </button>
            ) : (
              <ol className="mt-3 space-y-3">
                <Step n="A">Tocca il menu <b>⋮</b> in alto a destra del browser.</Step>
                <Step n="B">Tocca <b>«Installa app»</b> (o «Aggiungi a schermata Home»).</Step>
                <Step n="C">Conferma con <b>«Installa»</b>.</Step>
                <Step n="D">Apri <b>WashLoop</b> dalla nuova icona 🧺 sul telefono.</Step>
              </ol>
            )}
          </>
        ) : (
          <p className="mt-3 rounded-[14px] bg-ice px-4 py-3 text-sm font-medium text-muted">
            Apri <b>washloop.it</b> dal tuo <b>telefono</b> per installare l&apos;app: così la ritrovi comoda in schermata Home e ricevi le notifiche.
          </p>
        )}
      </section>

      {/* Step 2 — Notifiche */}
      <section className="rounded-[20px] border border-line bg-white p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-gradient-to-br from-blue to-cyan font-display text-sm font-black text-white">2</span>
          <h2 className="font-display text-lg font-black text-navy">Attiva le notifiche</h2>
        </div>
        <p className="mt-2 text-sm font-medium text-muted">Ti avvisiamo a ogni passaggio: ritiro, lavaggio, consegna e modifiche agli orari.</p>

        <div className="mt-3">
          {perm === "unsupported" ? (
            <p className="rounded-[14px] bg-ice px-4 py-3 text-sm font-medium text-muted">Questo browser non supporta le notifiche. Installa l&apos;app e riprova da lì.</p>
          ) : perm === "granted" ? (
            <p className="rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-bold text-[#1F8A5B]">🔔 Notifiche attive. Sei a posto!</p>
          ) : iosNeedsInstallFirst ? (
            <p className="rounded-[14px] bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">
              Su iPhone le notifiche funzionano <b>dopo</b> aver installato l&apos;app (passo 1). Installala, aprila dall&apos;icona 🧺 e torna qui per attivarle.
            </p>
          ) : perm === "denied" ? (
            <div className="rounded-[14px] bg-[#C0392B]/8 px-4 py-3 text-sm font-semibold text-[#C0392B]">
              Le notifiche risultano bloccate. Riattivale dalle impostazioni:
              <ul className="mt-1.5 list-disc pl-5 font-medium">
                <li><b>iPhone</b>: Impostazioni → Notifiche → WashLoop → «Consenti».</li>
                <li><b>Android</b>: Impostazioni app → WashLoop → Notifiche → attiva.</li>
              </ul>
            </div>
          ) : (
            <button
              onClick={enableNotifications}
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-br from-blue to-cyan py-3.5 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)] disabled:opacity-60"
            >
              {busy ? "Attivazione…" : "🔔 Attiva le notifiche"}
            </button>
          )}
        </div>
      </section>

      <p className="px-2 text-center text-xs font-medium text-muted">
        Serve aiuto? Scrivici a <a href="mailto:info@washloop.it" className="font-bold text-blue">info@washloop.it</a> e ti guidiamo noi. 💙
      </p>
    </div>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-ice font-display text-xs font-black text-blue">{n}</span>
      <span className="text-sm font-medium leading-relaxed text-navy">{children}</span>
    </li>
  );
}
