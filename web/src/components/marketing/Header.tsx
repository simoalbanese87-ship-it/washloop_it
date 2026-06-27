import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ButtonLink } from "@/components/ui/Button";

const nav = [
  { href: "/#come-funziona", label: "Come funziona" },
  { href: "/#prezzi", label: "Prezzi" },
  { href: "/#area", label: "Dove siamo" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
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
          <Link href="/login" className="hidden font-display text-sm font-bold text-navy/70 transition-colors hover:text-navy sm:block">
            Accedi
          </Link>
          <ButtonLink href="/onboarding" size="md">
            Attiva WashLoop →
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
