import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ConversionTracker } from "@/components/ConversionTracker";

export const metadata: Metadata = {
  title: "Richiesta ricevuta",
  robots: { index: false, follow: false },
};

/** Profili social. Array così aggiungerne uno è una riga: Facebook entra qui
 *  appena avremo l'URL della pagina. */
const SOCIAL = [
  {
    nome: "Instagram",
    href: "https://www.instagram.com/washloopitalia/",
    icona: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

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
            ? "Buone notizie: il tuo CAP rientra nell'area che copriamo a Milano. Ti ricontatteremo per fornirti maggiori informazioni sul servizio."
            : "Il tuo CAP non è ancora tra le zone che serviamo. Ti avvisiamo appena apriamo da te."}
        </p>

        {/* I social vanno su entrambe le varianti: anche chi è fuori zona può
            seguirci e vedere quando apriamo da lui. */}
        <div className="mt-10">
          <p className="font-display text-sm font-bold text-white/45">Seguici, così sai quando arriviamo</p>
          <div className="mt-3 flex justify-center gap-3">
            {SOCIAL.map((s) => (
              <a
                key={s.nome}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.nome}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[40px] border border-white/20 px-5 font-display text-sm font-extrabold text-white transition-colors hover:border-cyan hover:text-cyan"
              >
                {s.icona}
                {s.nome}
              </a>
            ))}
          </div>
        </div>

        {/* Il pulsante verso il sito vetrina compare solo a chi è in zona: a chi
            non copriamo non serve un invito a esplorare un servizio che non può
            ancora attivare. */}
        {covered && (
          <Link
            href="/"
            className="mt-10 inline-flex min-h-[52px] items-center justify-center rounded-[40px] bg-white px-7 font-display text-base font-extrabold text-navy transition-transform hover:-translate-y-0.5"
          >
            Scopri WashLoop →
          </Link>
        )}
      </div>
    </section>
  );
}
