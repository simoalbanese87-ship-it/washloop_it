"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { scanBag } from "@/lib/actions/orders";
import type { ScanResult } from "@/lib/orders";

/** Scanner QR per il rider. Inquadra il QR sulla borsa (= codice cliente WL-####):
 *  la webapp deduce dallo stato se è RITIRO o CONSEGNA e registra il pacco.
 *  Usa `qr-scanner` (import dinamico) → fotocamera posteriore, funziona su iOS.
 *
 *  ATTENZIONE al motivo per cui dopo ogni scan lo scanner si FERMA.
 *  Il QR stampato è il codice del CLIENTE, quindi tutte le borse dello stesso
 *  cliente hanno lo stesso identico codice. Prima c'era un anti-doppione a
 *  tempo: stesso codice ignorato per 3 secondi, poi riaccettato. Con la camera
 *  ferma su una borsa sola questo registrava una borsa ogni 3 secondi, e un
 *  ordine da 3 sacchi si chiudeva da solo in sei secondi senza che il rider
 *  toccasse niente. Una pausa a tempo non si può rendere sicura: l'unico
 *  segnale affidabile che c'è una borsa diversa davanti all'obiettivo è che
 *  il rider lo confermi. */

type Feedback = { tone: "ok" | "err"; title: string; sub: string; done?: boolean } | null;

export function RiderScanner({
  orderId,
  label = "Scansiona borsa",
  compact = false,
}: {
  /** Se lo scanner parte da una tappa precisa, l'ordine è già deciso: serve
   *  quando il cliente ha più ordini aperti nello stesso giro. */
  orderId?: string;
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const busyRef = useRef(false);
  // In pausa dopo ogni lettura: si riparte solo con un tocco del rider.
  const pausedRef = useRef(false);

  const handleDecode = useCallback(
    (raw: string) => {
      if (busyRef.current || pausedRef.current) return;
      busyRef.current = true;
      pausedRef.current = true;
      // Spegne anche il ciclo di decodifica: nessuna lettura può passare
      // mentre mostriamo l'esito.
      try { scannerRef.current?.pause?.(); } catch { /* noop */ }

      scanBag(raw, orderId)
        .then((res: ScanResult) => {
          if (res.ok) {
            const modeLabel = res.mode === "pickup" ? "RITIRO" : "CONSEGNA";
            try { navigator.vibrate?.(res.done ? [60, 40, 60] : 40); } catch { /* noop */ }
            setFeedback({
              tone: "ok",
              title: `${modeLabel} · borsa ${res.seq} di ${res.total}`,
              sub: res.done
                ? `${res.client} — tutte registrate ✓`
                : `${res.client} — metti via questa borsa, poi tocca «Borsa successiva»`,
              done: res.done,
            });
            router.refresh();
          } else {
            try { navigator.vibrate?.(200); } catch { /* noop */ }
            setFeedback({ tone: "err", title: "Non registrato", sub: res.error });
          }
        })
        .catch((e) => setFeedback({ tone: "err", title: "Errore", sub: e instanceof Error ? e.message : "Riprova" }))
        .finally(() => { busyRef.current = false; });
    },
    [router, orderId],
  );

  /** Riprende la lettura: è l'unico modo di registrare un'altra borsa. */
  const riprendi = useCallback(() => {
    setFeedback(null);
    pausedRef.current = false;
    try { scannerRef.current?.start?.(); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let scanner: { start: () => Promise<void>; stop: () => void; destroy: () => void } | null = null;

    (async () => {
      try {
        const QrScanner = (await import("qr-scanner")).default;
        if (cancelled || !videoRef.current) return;
        scanner = new QrScanner(
          videoRef.current,
          (result: { data: string }) => handleDecode(result.data),
          { preferredCamera: "environment", highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5, returnDetailedScanResult: true },
        );
        scannerRef.current = scanner;
        await scanner.start();
        if (!cancelled) setReady(true);
      } catch (e) {
        setFeedback({ tone: "err", title: "Fotocamera non disponibile", sub: e instanceof Error ? e.message : "Consenti l'accesso alla fotocamera" });
      }
    })();

    return () => {
      cancelled = true;
      setReady(false);
      pausedRef.current = false;
      try { scanner?.stop(); scanner?.destroy(); } catch { /* noop */ }
      scannerRef.current = null;
    };
  }, [open, handleDecode]);

  const apri = () => { setFeedback(null); pausedRef.current = false; setOpen(true); };

  return (
    <>
      <button
        onClick={apri}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-full border-2 border-navy/25 px-4 py-2 font-display text-sm font-extrabold text-navy"
            : "flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-3.5 font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)]"
        }
      >
        <ScanIcon /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-display text-sm font-extrabold text-white/90">
              {feedback ? "Esito" : "Inquadra il QR sulla borsa"}
            </span>
            <button onClick={() => setOpen(false)} className="rounded-full bg-white/15 px-3 py-1.5 font-display text-sm font-bold text-white">Chiudi</button>
          </div>

          <div className="relative flex-1 overflow-hidden">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            {!ready && !feedback && (
              <div className="absolute inset-0 grid place-items-center text-sm font-medium text-white/70">Avvio fotocamera…</div>
            )}
            {feedback && <div className="absolute inset-0 bg-black/55" aria-hidden />}
          </div>

          {feedback && (
            <div className={`px-5 py-4 ${feedback.tone === "ok" ? "bg-[#1F8A5B]" : "bg-[#C0392B]"}`}>
              <div className="font-display text-lg font-black text-white">{feedback.title}</div>
              <div className="mt-0.5 text-sm font-medium text-white/85">{feedback.sub}</div>

              <div className="mt-4 flex gap-2">
                {feedback.tone === "ok" && !feedback.done && (
                  <button
                    onClick={riprendi}
                    className="flex-1 rounded-full bg-white px-5 py-3 font-display text-base font-extrabold text-navy"
                  >
                    Borsa successiva →
                  </button>
                )}
                {feedback.tone === "err" && (
                  <button
                    onClick={riprendi}
                    className="flex-1 rounded-full bg-white px-5 py-3 font-display text-base font-extrabold text-navy"
                  >
                    Riprova
                  </button>
                )}
                {feedback.done && (
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-full bg-white px-5 py-3 font-display text-base font-extrabold text-navy"
                  >
                    Fine
                  </button>
                )}
              </div>
            </div>
          )}

          {!feedback && (
            <div className="px-5 pb-6 pt-3 text-center text-xs font-medium text-white/55">
              Ritiro o consegna vengono riconosciuti dallo stato dell&apos;ordine. Dopo ogni borsa lo scanner si ferma:
              tocca «Borsa successiva» per registrare la prossima.
            </div>
          )}
        </div>
      )}
    </>
  );
}

const ScanIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M4 12h16" />
  </svg>
);
