import type { Metadata } from "next";
import Link from "next/link";
import { Bubbles } from "@/components/marketing/Bubbles";
import { GUIDE } from "@/lib/guide";
import { OG_IMMAGINE } from "@/lib/og";

/* ============================================================
   Guide

   Perché il sito ne aveva bisogno
   -------------------------------
   Sei pagine, tutte commerciali: non c'era un solo posto del sito che qualcuno
   potesse avere voglia di linkare o di salvare. Un contenuto che risponde a una
   domanda pratica — «come lavo questo coso» — è l'unica cosa che un sito nuovo
   può offrire a chi non ha ancora nessuna intenzione di comprare.

   L'indice resta corto per scelta: quattro guide che si leggono tutte valgono
   più di quaranta pagine scritte per riempire.
   ============================================================ */

export const metadata: Metadata = {
  title: "Guide — lavare, stirare, far durare i capi",
  description:
    "Guide pratiche di WashLoop: come lavare un piumone, come stirare una camicia, quanto costa la lavanderia a Milano. Scritte da chi lava per mestiere.",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "Guide — WashLoop",
    description: "Come lavare un piumone, come stirare una camicia, quanto costa la lavanderia a Milano.",
    url: "https://washloop.it/guide",
    type: "website",
    locale: "it_IT",
    images: [OG_IMMAGINE],
  },
};

export default function GuidePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto max-w-4xl px-5 py-16 md:py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">Guide</div>
          <h1 className="mt-4 font-display text-4xl font-black leading-[1.05] tracking-[-0.03em] md:text-5xl">
            Quello che sappiamo <span className="text-cyan">perché lo facciamo tutti i giorni.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/65">
            Niente consigli della nonna e niente elenchi copiati: come si lavano e si stirano
            davvero le cose, e quando conviene smettere di provarci in casa.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <ul className="space-y-4">
            {GUIDE.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/guide/${g.slug}`}
                  className="block rounded-[24px] border border-line bg-ice p-7 transition-colors hover:border-blue/40"
                >
                  <h2 className="font-display text-xl font-black tracking-[-0.02em] text-navy">{g.titolo}</h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{g.sommario}</p>
                  <span className="mt-4 inline-block font-display text-sm font-extrabold text-blue">Leggi →</span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-sm font-medium text-muted">
            Cerchi il servizio invece della guida?{" "}
            <Link href="/lavanderia-a-domicilio-milano" className="font-bold text-blue underline">
              Lavanderia a domicilio a Milano
            </Link>{" "}
            o{" "}
            <Link href="/servizio-stiro-a-domicilio-milano" className="font-bold text-blue underline">
              solo stiro
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
