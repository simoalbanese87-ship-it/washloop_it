"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** Spara la conversione Google Ads una sola volta al caricamento della pagina
 *  di conferma. `send_to` = NEXT_PUBLIC_GADS_CONVERSION_LABEL (es.
 *  "AW-123456789/AbC-D_efg"). Deduplica su session_id via sessionStorage così
 *  un refresh non conta due volte. Se le env non ci sono, è un no-op. */
export function ConversionTracker() {
  const params = useSearchParams();

  useEffect(() => {
    const label = process.env.NEXT_PUBLIC_GADS_CONVERSION_LABEL;
    if (!label || typeof window.gtag !== "function") return;

    const sessionId = params.get("session_id") ?? "";
    const key = `wl_conv_${sessionId || "once"}`;
    if (sessionStorage.getItem(key)) return;

    const value = Number(params.get("value"));
    window.gtag("event", "conversion", {
      send_to: label,
      transaction_id: sessionId || undefined,
      currency: "EUR",
      ...(Number.isFinite(value) && value > 0 ? { value } : {}),
    });
    sessionStorage.setItem(key, "1");
  }, [params]);

  return null;
}
