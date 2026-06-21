"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { InstallBanner } from "@/components/app/InstallBanner";
import { NotificationPrompt } from "@/components/app/NotificationPrompt";
import { ImpersonationBanner } from "@/components/app/ImpersonationBanner";

/** Shell mobile-first dell'app cliente: header + contenuto + bottom tab bar
 *  con FAB centrale per prenotare. Allineato ai mockup (design-reference). */

type IconProps = { size?: number; active?: boolean };
const stroke = (active?: boolean) => ({ strokeWidth: active ? 2.4 : 2 });

const HomeIcon = ({ size = 24, active }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke(active)} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
  </svg>
);
const BagIcon = ({ size = 24, active }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke(active)} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 7h12l1 13H5z" /><path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);
const UserIcon = ({ size = 24, active }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke(active)} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" />
  </svg>
);
const PlusIcon = ({ size = 28 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const tabs = [
  { href: "/app", label: "Home", Icon: HomeIcon, exact: true },
  { href: "/app/ordini", label: "Ordini", Icon: BagIcon },
  { href: "/app/profilo", label: "Profilo", Icon: UserIcon },
];

export function MobileShell({ userName, children, impersonating }: { userName: string; children: React.ReactNode; impersonating?: boolean }) {
  const pathname = usePathname();
  const initial = (userName?.trim()?.[0] ?? "W").toUpperCase();
  const isActive = (t: (typeof tabs)[number]) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/"));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-ice">
      {impersonating && <ImpersonationBanner name={userName} />}
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-ice/90 px-5 pb-3 pt-5 backdrop-blur">
        <div>
          <div className="text-[13px] font-bold text-muted">Ciao 👋</div>
          <div className="-mt-0.5 font-display text-[22px] font-black tracking-[-0.03em] text-navy">{userName}</div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Esci"
            className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-black text-white shadow-[0_8px_20px_-8px_rgba(43,127,212,0.6)]"
            title="Esci"
          >
            {initial}
          </button>
        </form>
      </header>

      {/* Contenuto */}
      <main className="flex-1 px-5 pb-28 pt-1">
        <InstallBanner />
        {children}
      </main>

      <NotificationPrompt />

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[460px]">
        <div className="relative mx-3 mb-3 flex items-center justify-around rounded-[26px] border border-line bg-white/95 px-2 py-2.5 shadow-[0_12px_40px_-12px_rgba(27,45,94,0.35)] backdrop-blur">
          <TabLink t={tabs[0]} active={isActive(tabs[0])} />
          <TabLink t={tabs[1]} active={isActive(tabs[1])} />

          {/* FAB prenota */}
          <Link
            href="/app/prenota"
            aria-label="Prenota ritiro"
            className="grid h-14 w-14 -translate-y-5 place-items-center rounded-full bg-gradient-to-br from-blue to-cyan text-white shadow-[0_14px_30px_-8px_rgba(43,127,212,0.65)] transition-transform active:scale-95"
          >
            <PlusIcon />
          </Link>

          <TabLink t={tabs[2]} active={isActive(tabs[2])} />
          {/* spacer per simmetria col FAB */}
          <span className="w-[52px]" aria-hidden />
        </div>
      </nav>
    </div>
  );
}

function TabLink({ t, active }: { t: (typeof tabs)[number]; active: boolean }) {
  const { Icon } = t;
  return (
    <Link
      href={t.href}
      className={`flex w-[52px] flex-col items-center gap-1 transition-colors ${active ? "text-blue" : "text-navy/45"}`}
    >
      <Icon size={24} active={active} />
      <span className="font-display text-[10px] font-extrabold">{t.label}</span>
    </Link>
  );
}
