import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ConversionTracker } from "@/components/ConversionTracker";

export const metadata: Metadata = {
  title: "Richiesta ricevuta",
  robots: { index: false, follow: false },
};

/** Conferma dopo l'invio del form della landing.
 *  `?c=1|0` = solo il flag di copertura del CAP: nessun dato personale in URL
 *  (finirebbe in analytics, nei log e nel Referer). */
export default async function GraziePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const covered = c === "1";

  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="relative mx-auto max-w-2xl px-5 py-24 text-center md:py-32">
        <Suspense fallback={null}>
          <ConversionTracker label={process.env.NEXT_PUBLIC_GADS_LEAD_LABEL} />
        </Suspense>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan/15 text-cyan">
          <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        </div>

        <h1 className="mt-7 font-display text-4xl font-black leading-[1.08] tracking-[-0.02em] md:text-5xl">
          Richiesta ricevuta.
          <br />
          <span className="text-grad">Ci pensiamo noi.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-lg font-medium leading-relaxed text-white/70">
          {covered
            ? "Buone notizie: il tuo CAP rientra nell'area che copriamo a Milano. Ti ricontattiamo a breve per concordare il giorno fisso di ritiro."
            : "Il tuo CAP non è ancora tra le zone che serviamo. Ti avvisiamo appena apriamo da te."}
        </p>

        <Link
          href="/"
          className="mt-10 inline-flex min-h-[52px] items-center justify-center rounded-[40px] bg-white px-7 font-display text-base font-extrabold text-navy transition-transform hover:-translate-y-0.5"
        >
          Scopri WashLoop →
        </Link>
      </div>
    </section>
  );
}
