"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

type Mode = "signin" | "signup";

const input =
  "h-12 w-full rounded-[18px] border border-line bg-ice px-4 text-base font-medium text-navy outline-none focus:border-blue";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      setLoading(false);
      if (error) return setError(error.message);
      // Se la conferma email è disattivata, la sessione c'è subito
      if (data.session) router.push("/app");
      else setInfo("Account creato. Se richiesto, conferma l'email e poi accedi.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push("/app");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ice px-5 py-10">
      <Link href="/" className="mb-8">
        <Logo size={40} />
      </Link>
      <div className="w-full max-w-sm rounded-[24px] border border-line bg-white p-8 shadow-[var(--shadow-sm)]">
        <div className="font-display text-xl font-black text-navy">
          {mode === "signin" ? "Accedi a WashLoop" : "Crea il tuo account"}
        </div>
        <p className="mt-2 text-sm font-medium text-muted">
          {mode === "signin" ? "Entra con email e password." : "Bastano email e password per iniziare."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
          {mode === "signup" && (
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome e cognome"
              className={input}
            />
          )}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.it"
            className={input}
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 caratteri)"
            className={input}
          />
          {error && <p className="text-sm font-semibold text-[#C0392B]">{error}</p>}
          {info && <p className="text-sm font-semibold text-[#1F8A5B]">{info}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Attendi…" : mode === "signin" ? "Accedi →" : "Crea account →"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
          className="mt-5 w-full text-center text-sm font-semibold text-muted hover:text-navy"
        >
          {mode === "signin" ? "Non hai un account? Creane uno" : "Hai già un account? Accedi"}
        </button>
      </div>
      <Link href="/" className="mt-6 text-sm font-semibold text-muted hover:text-navy">
        ← Torna al sito
      </Link>
    </div>
  );
}
