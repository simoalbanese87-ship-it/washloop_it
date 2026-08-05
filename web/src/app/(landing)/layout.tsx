import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LEGAL } from "@/lib/legal";
import { CookiePrefsLink } from "@/components/marketing/CookiePrefsLink";

/** Shell della landing pubblicitaria: header e footer ridotti al minimo.
 *  Niente menu del sito: ogni link in uscita è una conversione persa. */

function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/disponibilita" aria-label="WashLoop, torna all'inizio">
          <Logo variant="white" size={26} />
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-1.5 font-display text-sm font-bold text-white/70 sm:inline-flex">
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
            Milano
          </span>
          <a
            href="#richiesta"
            className="inline-flex min-h-[42px] items-center justify-center rounded-[40px] bg-white px-5 font-display text-sm font-extrabold text-navy transition-transform hover:-translate-y-0.5"
          >
            Verifica disponibilità
          </a>
        </div>
      </div>
    </header>
  );
}

function LandingFooter() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo variant="white" size={24} />
          <p className="mt-3 text-sm font-medium text-white/55">Lavanderia in abbonamento per Milano.</p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-white/60">
          <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
          <li><Link href="/cookie" className="hover:text-white">Cookie Policy</Link></li>
          <li><CookiePrefsLink className="hover:text-white" /></li>
          <li><a href="mailto:info@washloop.it" className="hover:text-white">info@washloop.it</a></li>
        </ul>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-5 text-xs font-medium text-white/35">
          WashLoop © 2026 · {LEGAL.company} · P.IVA {LEGAL.vat} · {LEGAL.address}
        </div>
      </div>
    </footer>
  );
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LandingHeader />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </>
  );
}
