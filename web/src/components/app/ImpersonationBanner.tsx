"use client";

import { stopImpersonate } from "@/lib/actions/impersonate";

/** Barra in cima quando un admin sta impersonando un cliente. */
export function ImpersonationBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#C9881F] px-4 py-2 text-white">
      <span className="min-w-0 truncate font-display text-xs font-extrabold">
        👁️ Stai impersonando: {name}
      </span>
      <form action={stopImpersonate}>
        <button type="submit" className="flex-none rounded-full bg-white/20 px-3 py-1 font-display text-xs font-extrabold text-white">
          Torna admin
        </button>
      </form>
    </div>
  );
}
