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

/** Guida all'installazione (pagina /app/installa).
 *
 *  Riconosce il telefono e mostra i passi giusti, ma **non nasconde mai gli
 *  altri**: da computer si vedono entrambi i sistemi con il codice da
 *  inquadrare, e da telefono c'è sempre il modo di aprire le istruzioni
 *  dell'altro. Il riconoscimento del browser sbaglia più spesso di quanto si
 *  creda — un iPad si dichiara un Mac, un browser dentro Instagram si dichiara
 *  quello che gli pare — e chi resta fuori dal caso previsto non deve trovare
 *  un vicolo cieco. Prima, da computer, l'unica cosa scritta era «apri
 *  washloop.it dal telefono»: vera, e inutile. */
export function InstallGuide({ url }: { url: string }) {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [standalone, setStandalone] = useState(false);
  const [perm, setPerm] = useState<Perm>("default");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [mostraTutto, setMostraTutto] = useState(false);

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
  const suTelefono = platform !== "desktop";

  return (
    <div className="space-y-4">
      {/* Step 1 — Installa */}
      <section className="rounded-[20px] border border-line bg-white p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-gradient-to-br from-blue to-cyan font-display text-sm font-black text-white">1</span>
          <h2 className="font-display text-lg font-black text-navy">Metti WashLoop sul telefono</h2>
        </div>

        {standalone ? (
          <p className="mt-3 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-bold text-[#1F8A5B]">✅ Perfetto, stai già usando l&apos;app installata!</p>
        ) : platform === "desktop" ? (
          <>
            <p className="mt-3 text-sm font-medium text-muted">
              Sei al computer. L&apos;app si installa <b>dal telefono</b>: il modo più veloce è inquadrare questo codice.
            </p>
            <DaComputer url={url} />
            <div className="mt-5 border-t border-line pt-4">
              <p className="font-display text-sm font-extrabold text-navy">Poi, sul telefono, fai così:</p>
              <div className="mt-3 space-y-4">
                <Blocco titolo="🍎 Se hai un iPhone"><PassiIPhone /></Blocco>
                <Blocco titolo="🤖 Se hai un Android"><PassiAndroid /></Blocco>
              </div>
            </div>
          </>
        ) : platform === "ios-safari" ? (
          <>
            <p className="mt-3 text-sm font-medium text-muted">Aggiungi WashLoop alla schermata Home del tuo iPhone:</p>
            <PassiIPhone />
          </>
        ) : platform === "ios-other" ? (
          <>
            <p className="mt-3 rounded-[14px] bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">
              Su iPhone l&apos;app si installa <b>solo da Safari</b> — la bussola azzurra 🧭. Stai usando un altro browser:
              copia <b>washloop.it</b>, aprilo in Safari e poi segui questi passi.
            </p>
            <PassiIPhone />
          </>
        ) : (
          <>
            <p className="mt-3 text-sm font-medium text-muted">Aggiungi WashLoop alla schermata Home:</p>
            {deferred && (
              <button onClick={androidInstall} className="mt-3 w-full rounded-full bg-gradient-to-br from-blue to-cyan py-3.5 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
                📲 Installa WashLoop
              </button>
            )}
            {/* I passi restano anche col pulsante: su alcuni Android il pulsante
                non compare mai, e chi lo aspetta resterebbe fermo. */}
            <PassiAndroid />
          </>
        )}

        {/* Da telefono si mostra un sistema solo, ma il riconoscimento può
            sbagliare: chi non si ritrova nei passi deve poter vedere gli altri. */}
        {suTelefono && !standalone && (
          <div className="mt-4 border-t border-line pt-3">
            <button onClick={() => setMostraTutto((v) => !v)} className="font-display text-xs font-bold text-blue">
              {mostraTutto ? "Nascondi le altre istruzioni" : "Non ti ritrovi? Vedi le istruzioni per l'altro telefono →"}
            </button>
            {mostraTutto && (
              <div className="mt-3 space-y-4">
                <Blocco titolo="🍎 iPhone"><PassiIPhone /></Blocco>
                <Blocco titolo="🤖 Android"><PassiAndroid /></Blocco>
              </div>
            )}
          </div>
        )}

        {!standalone && (
          <p className="mt-4 rounded-[14px] bg-ice px-4 py-3 text-xs font-medium text-muted">
            <b className="text-navy">Come capisci che è fatta:</b> sulla schermata del telefono compare l&apos;icona
            WashLoop 🧺. Aprendola da lì, l&apos;app si vede a tutto schermo, senza la barra degli indirizzi del browser.
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
          ) : platform === "desktop" ? (
            <p className="rounded-[14px] bg-ice px-4 py-3 text-sm font-medium text-muted">
              Le notifiche si attivano <b>dal telefono</b>, dopo aver installato l&apos;app: apri WashLoop dall&apos;icona 🧺 e torna
              su questa pagina.
            </p>
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
        Non ci riesci? Scrivici a <a href="mailto:info@washloop.it" className="font-bold text-blue">info@washloop.it</a>: lo
        facciamo insieme al telefono, ci vuole un minuto. 💙
      </p>
    </div>
  );
}

/** Il codice da inquadrare, più le vie di scampo per chi non ci riesce. */
function DaComputer({ url }: { url: string }) {
  const [copiato, setCopiato] = useState(false);
  const pulito = url.replace(/^https?:\/\//, "");

  async function copia() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2500);
    } catch {
      /* Se il browser non lo permette resta l'indirizzo scritto qui sotto. */
    }
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-4 rounded-[16px] bg-ice p-5 sm:flex-row sm:items-center">
      {/* Immagine servita da un indirizzo suo, non incorporata nella pagina:
          vedi il commento in `api/qr-installa`. `<img>` semplice come per il QR
          del profilo e delle etichette. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/qr-installa"
        alt={`Codice QR per aprire ${pulito} sul telefono`}
        width={168}
        height={168}
        className="h-[168px] w-[168px] flex-none rounded-[12px] bg-white p-2"
      />
      <div className="min-w-0 text-center sm:text-left">
        <p className="font-display text-sm font-extrabold text-navy">Apri la fotocamera del telefono e inquadra il codice</p>
        <p className="mt-1 text-sm font-medium text-muted">
          Non serve nessuna app per leggerlo: basta la fotocamera. Tocca l&apos;avviso che compare e si apre WashLoop.
        </p>
        <p className="mt-3 text-xs font-medium text-muted">
          Oppure scrivi <b className="text-navy">{pulito}</b> nel browser del telefono.
        </p>
        <button onClick={copia} className="mt-2 font-display text-xs font-bold text-blue hover:underline">
          {copiato ? "✓ Indirizzo copiato" : "Copia l'indirizzo"}
        </button>
      </div>
    </div>
  );
}

function Blocco({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-line p-4">
      <div className="font-display text-sm font-extrabold text-navy">{titolo}</div>
      {children}
    </div>
  );
}

function PassiIPhone() {
  return (
    <ol className="mt-3 space-y-3">
      <Step n="A">
        Apri <b>washloop.it</b> con <b>Safari</b>, la bussola azzurra 🧭. Con altri browser il passaggio non c&apos;è.
      </Step>
      <Step n="B">
        Tocca l&apos;icona <b>Condividi</b> <ShareIcon /> — il quadrato con la freccia verso l&apos;alto, in fondo allo
        schermo (su iPad è in alto a destra).
      </Step>
      <Step n="C">
        Scorri l&apos;elenco verso il basso e tocca <b>«Aggiungi a schermata Home»</b>{" "}
        <span className="text-muted">(«Add to Home Screen» se il telefono è in inglese)</span>.
      </Step>
      <Step n="D">In alto a destra tocca <b>«Aggiungi»</b>.</Step>
      <Step n="E">Chiudi Safari e apri <b>WashLoop</b> dalla nuova icona 🧺.</Step>
    </ol>
  );
}

function PassiAndroid() {
  return (
    <ol className="mt-3 space-y-3">
      <Step n="A">Apri <b>washloop.it</b> con <b>Chrome</b>.</Step>
      <Step n="B">Tocca il menu <b>⋮</b> — i tre puntini in alto a destra.</Step>
      <Step n="C">
        Tocca <b>«Installa app»</b> oppure <b>«Aggiungi a schermata Home»</b>: cambia col modello del telefono, è una
        delle due.
      </Step>
      <Step n="D">Conferma con <b>«Installa»</b>.</Step>
      <Step n="E">Apri <b>WashLoop</b> dalla nuova icona 🧺.</Step>
    </ol>
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
