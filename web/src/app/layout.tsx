import type { Metadata, Viewport } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import { PWARegister } from "@/components/PWARegister";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { GoogleAdsTag } from "@/components/GoogleAdsTag";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "WashLoop — Smetti di fare il bucato. Inizia a vivere.",
    template: "%s · WashLoop",
  },
  description:
    "Lavanderia a domicilio in abbonamento a Milano. Ritiriamo, laviamo, stiriamo e ti riconsegniamo il guardaroba a casa. Tutto dal telefono, zero pensieri.",
  metadataBase: new URL("https://washloop.it"),
  openGraph: {
    title: "WashLoop — Smetti di fare il bucato. Inizia a vivere.",
    description: "Lavanderia a domicilio in abbonamento a Milano. Tutto dal telefono.",
    type: "website",
    locale: "it_IT",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b2d5e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${nunito.variable} ${nunitoSans.variable} h-full`} data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col antialiased">
        {/* Defs SVG condivise: gradiente bolla del logo */}
        <svg width="0" height="0" className="absolute" aria-hidden>
          <defs>
            <radialGradient id="wlBub" cx="36%" cy="30%" r="74%">
              <stop offset="0" stopColor="#a6f1ff" />
              <stop offset="0.44" stopColor="#00c8f0" />
              <stop offset="1" stopColor="#2b7fd4" />
            </radialGradient>
          </defs>
        </svg>
        {children}
        <CookieBanner />
        <PWARegister />
        <GoogleAdsTag />
      </body>
    </html>
  );
}
