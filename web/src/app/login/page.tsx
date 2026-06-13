"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ice px-5">
      <Link href="/" className="mb-8">
        <Logo size={40} />
      </Link>
      <div className="w-full max-w-sm rounded-[24px] border border-line bg-white p-8 shadow-[var(--shadow-sm)]">
        {sent ? (
          <div className="text-center">
            <div className="font-display text-xl font-black text-navy">Controlla la mail 📬</div>
            <p className="mt-3 text-sm font-medium text-muted">
              Ti abbiamo inviato un link di accesso a <strong className="text-navy">{email}</strong>. Aprilo da questo dispositivo per entrare.
            </p>
          </div>
        ) : (
          <>
            <div className="font-display text-xl font-black text-navy">Accedi a WashLoop</div>
            <p className="mt-2 text-sm font-medium text-muted">Inserisci la tua email: ti mandiamo un link, niente password.</p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.it"
                className="h-12 rounded-[18px] border border-line bg-ice px-4 text-base font-medium text-navy outline-none focus:border-blue"
              />
              {error && <p className="text-sm font-semibold text-[#C0392B]">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Invio…" : "Inviami il link →"}
              </Button>
            </form>
          </>
        )}
      </div>
      <Link href="/" className="mt-6 text-sm font-semibold text-muted hover:text-navy">
        ← Torna al sito
      </Link>
    </div>
  );
}
