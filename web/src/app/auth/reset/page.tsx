"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

const input =
  "h-[54px] w-full rounded-[18px] border-2 border-white/15 bg-white/[0.08] px-4 text-base font-semibold text-white placeholder:font-medium placeholder:text-white/45 outline-none transition-colors focus:border-cyan focus:bg-white/[0.12]";

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => {
      router.push("/app");
      router.refresh();
    }, 1200);
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-6 py-10 text-white"
      style={{ background: "radial-gradient(120% 90% at 78% 0%, #2a4a8e 0%, #1B2D5E 52%, #142046 100%)" }}
    >
      <div className="w-full max-w-sm">
        <Logo variant="white" size={40} />
        <h1 className="mt-8 font-display text-[28px] font-black leading-tight tracking-[-0.02em]">Nuova password</h1>
        <p className="mt-2 text-[15px] font-medium text-white/70">Scegli una nuova password per il tuo account.</p>

        {done ? (
          <div className="mt-6 rounded-[16px] border border-cyan/30 bg-cyan/10 p-4 text-sm font-semibold text-cyan">
            Password aggiornata ✓ — ti porto nell&apos;app…
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Nuova password (min 8 caratteri)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
            {error && <p className="text-sm font-semibold text-[#ff9b8f]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="flex h-[54px] w-full items-center justify-center rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)] disabled:opacity-40"
            >
              {loading ? "Aggiorno…" : "Aggiorna password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
