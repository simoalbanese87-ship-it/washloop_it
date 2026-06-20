import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LEGAL } from "@/lib/legal";
import { CookiePrefsLink } from "./CookiePrefsLink";

export function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo variant="white" size={28} />
          <p className="mt-4 max-w-xs text-sm font-medium text-white/55">
            Lavanderia a domicilio in abbonamento. Milano. Smetti di fare il bucato, inizia a vivere.
          </p>
        </div>
        <div>
          <div className="mb-4 font-display text-xs font-extrabold uppercase tracking-[0.2em] text-cyan">Servizio</div>
          <ul className="space-y-2.5 text-sm font-medium text-white/70">
            <li><Link href="/#come-funziona" className="hover:text-white">Come funziona</Link></li>
            <li><Link href="/#prezzi" className="hover:text-white">Prezzi</Link></li>
            <li><Link href="/#area" className="hover:text-white">Zone coperte</Link></li>
            <li><Link href="/#faq" className="hover:text-white">Domande frequenti</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-4 font-display text-xs font-extrabold uppercase tracking-[0.2em] text-cyan">Azienda</div>
          <ul className="space-y-2.5 text-sm font-medium text-white/70">
            <li><Link href="/login" className="hover:text-white">Area clienti</Link></li>
            <li><a href="mailto:ciao@washloop.it" className="hover:text-white">ciao@washloop.it</a></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
            <li><Link href="/cookie" className="hover:text-white">Cookie Policy</Link></li>
            <li><CookiePrefsLink className="hover:text-white" /></li>
            <li><Link href="/termini" className="hover:text-white">Condizioni di vendita</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-6 text-xs font-medium text-white/35">
          WashLoop © 2026 · {LEGAL.company} · P.IVA {LEGAL.vat} · {LEGAL.address}
        </div>
      </div>
    </footer>
  );
}
