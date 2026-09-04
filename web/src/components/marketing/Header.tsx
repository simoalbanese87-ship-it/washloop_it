import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { MobileMenu } from "@/components/marketing/MobileMenu";

const nav = [
  { href: "/#come-funziona", label: "Come funziona" },
  { href: "/#prezzi", label: "Prezzi" },
  { href: "/#area", label: "Dove siamo" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    // Niente `relative` qui: `sticky` è già un elemento posizionato e fa da
    // riferimento al pannello del menu. Metterli entrambi significa scrivere
    // due volte la stessa proprietà CSS e sperare nell'ordine delle regole.
    <header className="sticky top-0 z-50 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="WashLoop home">
          <Logo size={30} />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-display text-sm font-bold text-navy/70 transition-colors hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {/* "Accedi" sempre in chiaro, anche sul telefono.
              Stava solo dentro il menu a panino: per entrare servivano due
              tocchi, e chi è già cliente non pensa a cercarsi il proprio
              account dietro un menu — cerca la parola «Accedi». Un tocco. */}
          <Link
            href="/login"
            className="whitespace-nowrap font-display text-sm font-bold text-navy/70 transition-colors hover:text-navy"
          >
            Accedi
          </Link>
          {/* Il testo intero non ci sta su un telefono stretto accanto al logo
              e al menu: là il pulsante si accorcia invece di mandare la riga a
              capo o di far sparire qualcosa. */}
          <ButtonLink href="/onboarding" size="md">
            <span className="sm:hidden">Attiva</span>
            <span className="hidden sm:inline">Attiva WashLoop →</span>
          </ButtonLink>
          <MobileMenu voci={nav} />
        </div>
      </div>
    </header>
  );
}
