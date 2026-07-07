import Script from "next/script";

/** Tag globale Google Ads/gtag. Si attiva solo se è impostata la env
 *  NEXT_PUBLIC_GADS_ID (es. "AW-1234567890"). Senza env non carica nulla,
 *  così sviluppo/preview restano puliti. La conversione vera viene sparata
 *  dalla pagina di conferma (/checkout/grazie). */
export function GoogleAdsTag() {
  const id = process.env.NEXT_PUBLIC_GADS_ID;
  if (!id) return null;
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
