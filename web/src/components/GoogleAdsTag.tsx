"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CONSENT_CHANGED_EVENT, hasMarketingConsent } from "@/components/marketing/CookieBanner";

/** Tag globale Google Ads/gtag. Si attiva solo se è impostata la env
 *  NEXT_PUBLIC_GADS_ID (es. "AW-1234567890"). Senza env non carica nulla,
 *  così sviluppo/preview restano puliti. La conversione vera viene sparata
 *  dalla pagina di conferma (/checkout/grazie).
 *
 *  Come il pixel Meta, parte SOLO dopo "Accetta tutti": gtag scrive `_gcl_au`,
 *  che è un cookie pubblicitario a 90 giorni. Senza questo gate la nostra stessa
 *  cookie policy — che promette il contrario — sarebbe una dichiarazione falsa. */
export function GoogleAdsTag() {
  const id = process.env.NEXT_PUBLIC_GADS_ID;
  const [consentito, setConsentito] = useState(false);

  useEffect(() => {
    const sync = () => setConsentito(hasMarketingConsent());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  if (!id || !consentito) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="gads-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
