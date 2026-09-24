"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CONSENT_CHANGED_EVENT, hasMarketingConsent } from "@/components/marketing/CookieBanner";

/** Meta Pixel. Cookie pubblicitario/di profilazione: si carica SOLO dopo
 *  "Accetta tutti" nel banner (GDPR, linee guida Garante). Chi sceglie "Solo
 *  necessari" non lo vede mai, e la scelta viene riletta senza ricaricare.
 *  Si attiva solo con NEXT_PUBLIC_META_PIXEL_ID: senza env, sviluppo e preview
 *  restano puliti — stesso schema di GoogleAdsTag.
 *
 *  Il fallback <noscript><img> del codice ufficiale è volutamente omesso:
 *  senza JavaScript non si può leggere il consenso, quindi quel pixel
 *  partirebbe comunque, anche per chi ha rifiutato. */
export function MetaPixel() {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(hasMarketingConsent());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  if (!id || !allowed) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');`}
    </Script>
  );
}
