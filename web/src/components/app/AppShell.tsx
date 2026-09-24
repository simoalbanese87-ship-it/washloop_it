import Link from "next/link";
import { Logo } from "@/components/Logo";
import { signOut } from "@/lib/actions/auth";
import { NavLinks } from "./NavLinks";

export type NavItem = { href: string; label: string };

export function AppShell({
  nav,
  userName,
  badge,
  children,
}: {
  nav: NavItem[];
  userName?: string | null;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ice">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link href={nav[0]?.href ?? "/"} aria-label="WashLoop">
              <Logo size={26} />
            </Link>
            {badge && (
              <span className="rounded-full bg-navy px-2.5 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.12em] text-cyan">
                {badge}
              </span>
            )}
          </div>
          <NavLinks nav={nav} variant="desktop" />
          <div className="flex items-center gap-3">
            {userName && <span className="hidden text-sm font-semibold text-muted sm:block">{userName}</span>}
            <form action={signOut}>
              <button className="font-display text-sm font-bold text-navy/55 transition-colors hover:text-navy" type="submit">
                Esci
              </button>
            </form>
          </div>
        </div>
        <NavLinks nav={nav} variant="mobile" />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}

/** Card riusabile per le pagine app. */
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[24px] border border-line bg-white p-6 shadow-[var(--shadow-sm)] ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function PageTitle({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      {kicker && <div className="font-display text-xs font-extrabold uppercase tracking-[0.22em] text-blue">{kicker}</div>}
      <h1 className="mt-1.5 font-display text-3xl font-black tracking-[-0.02em] text-navy">{title}</h1>
      {sub && <p className="mt-1.5 text-sm font-medium text-muted">{sub}</p>}
    </div>
  );
}
