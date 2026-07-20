"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { scanBag } from "@/lib/actions/orders";
import type { ScanResult } from "@/lib/orders";

/** Scanner QR per il rider. Inquadra il QR sulla borsa (= codice cliente WL-####):
 *  la webapp deduce dallo stato se è RITIRO o CONSEGNA e registra il pacco.
 *  Usa `qr-scanner` (import dinamico) → fotocamera posteriore, funziona su iOS. */

type Feedback = { tone: "ok" | "err"; title: string; sub: string } | null;

export function RiderScanner() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const handleDecode = useCallback((raw: string) => {
    const now = Date.now();
    // Anti-doppione: ignora lo stesso codice entro 3s o durante un'elaborazione.
    if (busyRef.current) return;
    if (raw === lastRef.current.code && now - lastRef.current.at < 3000) return;
    lastRef.current = { code: raw, at: now };
    busyRef.current = true;

    scanBag(raw)
      .then((res: ScanResult) => {
        if (res.ok) {
          const modeLabel = res.mode === "pickup" ? "RITIRO" : "CONSEGNA";
          try { navigator.vibrate?.(res.done ? [60, 40, 60] : 40); } catch { /* noop */ }
          setFeedback({
            tone: "ok",
            title: `${modeLabel} · pacco ${res.seq}/${res.total}`,
            sub: res.done ? `${res.client} — completato ✓` : `${res.client} — inquadra il prossimo pacco`,
          });
          router.refresh();
        } else {
          try { navigator.vibrate?.(200); } catch { /* noop */ }
          setFeedback({ tone: "err", title: "Non registrato", sub: res.error });
        }
      })
      .catch((e) => setFeedback({ tone: "err", title: "Errore", sub: e instanceof Error ? e.message : "Riprova" }))
      .finally(() => { setTimeout(() => { busyRef.current = false; }, 900); });
  }, [router]);

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
      try { scanner?.stop(); scanner?.destroy(); } catch { /* noop */ }
      scannerRef.current = null;
    };
  }, [open, handleDecode]);

  return (
    <>
      <button
        onClick={() => { setFeedback(null); setOpen(true); }}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-3.5 font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)]"
      >
        <ScanIcon /> Scansiona borsa
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-display text-sm font-extrabold text-white/90">Inquadra il QR sulla borsa</span>
            <button onClick={() => setOpen(false)} className="rounded-full bg-white/15 px-3 py-1.5 font-display text-sm font-bold text-white">Chiudi</button>
          </div>

          <div className="relative flex-1 overflow-hidden">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            {!ready && !feedback && (
              <div className="absolute inset-0 grid place-items-center text-sm font-medium text-white/70">Avvio fotocamera…</div>
            )}
          </div>

          {feedback && (
            <div className={`px-5 py-4 ${feedback.tone === "ok" ? "bg-[#1F8A5B]" : "bg-[#C0392B]"}`}>
              <div className="font-display text-lg font-black text-white">{feedback.title}</div>
              <div className="mt-0.5 text-sm font-medium text-white/85">{feedback.sub}</div>
            </div>
          )}
          <div className="px-5 pb-6 pt-3 text-center text-xs font-medium text-white/55">
            Ritiro o Consegna vengono riconosciuti in automatico dallo stato dell&apos;ordine. Continua a inquadrare i pacchi successivi.
          </div>
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
