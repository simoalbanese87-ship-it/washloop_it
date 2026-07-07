import { Suspense } from "react";
import Link from "next/link";
import { ConversionTracker } from "@/components/ConversionTracker";

export const metadata = {
  title: "Ordine confermato",
  // Pagina di conversione: non indicizzare.
  robots: { index: false, follow: false },
};

/** Pagina di conferma ordine/abbonamento. È l'URL di ritorno di Stripe Checkout
 *  e la "pagina di conversione" da usare in Google Ads: al caricamento spara
 *  l'evento di conversione (ConversionTracker). */
export default function GraziePage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{ background: "radial-gradient(120% 90% at 78% 0%, #2a4a8e 0%, #1B2D5E 52%, #142046 100%)" }}
    >
      {/* Evento di conversione Google Ads (client, una volta) */}
      <Suspense fallback={null}>
        <ConversionTracker />
      </Suspense>

      <section className="w-full max-w-[440px] rounded-[26px] bg-white/[0.06] px-6 py-10 text-center text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] backdrop-blur">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#2b7fd4] to-[#00c8f0] shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)]">
          <svg width={42} height={42} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="mt-6 font-display text-[28px] font-black leading-tight">Tutto confermato! 🎉</h1>
        <p className="mt-3 text-sm font-medium text-white/70">
          Il tuo abbonamento WashLoop è attivo. Ti abbiamo inviato un&apos;email di conferma: ora puoi prenotare il primo ritiro dall&apos;app.
        </p>

        <div className="mt-7 space-y-3">
          <Link
            href="/app/prenota"
            className="flex h-[54px] w-full items-center justify-center rounded-full bg-gradient-to-br from-[#2b7fd4] to-[#00c8f0] font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)]"
          >
            Prenota il primo ritiro →
          </Link>
          <Link href="/app" className="flex h-[54px] w-full items-center justify-center rounded-full border-2 border-white/25 font-display text-base font-extrabold text-white">
            Vai alla home
          </Link>
        </div>
      </section>
    </main>
  );
}
