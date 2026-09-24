"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./AppShell";

export function NavLinks({ nav, variant }: { nav: NavItem[]; variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  const cls = variant === "desktop" ? "hidden items-center gap-6 md:flex" : "flex gap-4 overflow-x-auto border-t border-line px-5 py-2.5 md:hidden";

  return (
    <nav className={cls}>
      {nav.map((item) => {
        const active = pathname === item.href || (item.href !== "/app" && item.href !== "/admin" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap font-display text-sm font-bold transition-colors ${
              active ? "text-navy" : "text-navy/55 hover:text-navy"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
