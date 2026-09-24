import Link from "next/link";
import { LEGAL } from "@/lib/legal";

/** Contenitore comune alle pagine legali: titolo, data, prose brandizzata. */
export function LegalShell({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <Link href="/" className="font-display text-sm font-bold text-blue hover:underline">
        ← Torna alla home
      </Link>
      <h1 className="mt-4 font-display text-4xl font-black tracking-[-0.02em] text-navy">{title}</h1>
      <p className="mt-2 text-sm font-medium text-muted">Ultimo aggiornamento: {LEGAL.lastUpdated}</p>
      {intro && <p className="mt-5 text-base font-medium leading-relaxed text-navy/75">{intro}</p>}
      <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-navy/75">{children}</div>
    </article>
  );
}

/** Sezione con titoletto. */
export function LegalSection({ n, title, children }: { n?: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-extrabold text-navy">
        {n ? `${n}. ` : ""}
        {title}
      </h2>
      <div className="mt-2.5 space-y-3">{children}</div>
    </section>
  );
}
