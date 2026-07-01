"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Logo } from "@/components/Logo";

type Mode = "signin" | "signup";

const input =
  "h-[54px] w-full rounded-[18px] border-2 border-white/15 bg-white/[0.08] px-4 text-base font-semibold text-white placeholder:font-medium placeholder:text-white/45 outline-none transition-colors focus:border-cyan focus:bg-white/[0.12]";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Piano scelto sulla home (Attiva → iscrizione → pay) e destinazione post-auth.
  const planCode = params.get("plan");
  const nextParam = params.get("next");
  const dest = planCode ? `/app/checkout?plan=${planCode}` : nextParam ?? "/app";

  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
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
      if (!accepted) {
        setLoading(false);
        return setError("Devi accettare i Termini e la Privacy per continuare.");
      }
      const acceptedAt = new Date().toISOString();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, terms_accepted_at: acceptedAt } },
      });
      if (error) {
        setLoading(false);
        return setError(error.message);
      }
      // Se la conferma email è disattivata, la sessione c'è subito → vai al checkout/app.
      if (data.session && data.user) {
        await supabase.from("profiles").update({ terms_accepted_at: acceptedAt }).eq("id", data.user.id);
        setLoading(false);
        router.push(dest);
        router.refresh();
      } else {
        setLoading(false);
        setInfo("Account creato. Se richiesto, conferma l'email e poi accedi.");
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push(dest);
    router.refresh();
  }

  async function forgotPassword() {
    if (!email) return setError("Inserisci prima la tua email qui sopra.");
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await requestPasswordReset(email);
    } catch {
      /* messaggio neutro comunque, per non rivelare se l'email esiste */
    }
    setLoading(false);
    setInfo("Se l'indirizzo è registrato, ti abbiamo inviato un'email per reimpostare la password. Controlla anche lo spam.");
  }

  const isSignup = mode === "signup";

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden px-6 py-10 text-white"
      style={{ background: "radial-gradient(120% 90% at 78% 0%, #2a4a8e 0%, #1B2D5E 52%, #142046 100%)" }}
    >
      {/* Bolle decorative */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="wl-bubble absolute h-28 w-28" style={{ left: "8%", top: "14%", animation: "wl-float 7s ease-in-out infinite" }} />
        <div className="wl-bubble absolute h-16 w-16" style={{ right: "12%", top: "30%", animation: "wl-float 9s ease-in-out infinite" }} />
        <div className="wl-bubble absolute h-20 w-20" style={{ right: "22%", bottom: "12%", animation: "wl-float 8s ease-in-out infinite" }} />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <Logo variant="white" payoff={isSignup} size={isSignup ? 44 : 40} />

        <div className="mt-9">
          <div className="font-display text-[12px] font-extrabold uppercase tracking-[0.18em] text-cyan">
            {isSignup ? "Crea il tuo account" : "Bentornato"}
          </div>
          <h1 className="mt-2.5 font-display text-[30px] font-black leading-[1.08] tracking-[-0.02em]">
            {isSignup ? (
              <>Iniziamo<br />da te.</>
            ) : (
              <>Accedi a<br />WashLoop.</>
            )}
          </h1>
          <p className="mt-2.5 text-[15px] font-medium leading-relaxed text-white/70">
            {isSignup
              ? planCode
                ? "Crea l'account: subito dopo attivi l'abbonamento."
                : "Bastano pochi dati. Niente impegni — disdici quando vuoi."
              : "Entra con email e password."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-3">
          {isSignup && (
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
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 caratteri)"
            className={input}
          />
          {error && <p className="text-sm font-semibold text-[#ff9b8f]">{error}</p>}
          {info && <p className="text-sm font-semibold text-[#5ce6a8]">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-[54px] w-full items-center justify-center rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)] transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
          >
            {loading ? "Attendi…" : isSignup ? "Crea account →" : "Accedi →"}
          </button>
        </form>

        {!isSignup && (
          <button
            type="button"
            onClick={forgotPassword}
            disabled={loading}
            className="mt-3 w-full text-center text-sm font-semibold text-white/60 transition-colors hover:text-white disabled:opacity-40"
          >
            Password dimenticata?
          </button>
        )}

        {isSignup && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-left text-[13px] font-medium leading-relaxed text-white">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[#00c8f0]" />
            <span>Accetto i <Link href="/termini" className="font-bold underline">Termini</Link> e la <Link href="/privacy" className="font-bold underline">Privacy policy</Link> del servizio.</span>
          </label>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(isSignup ? "signin" : "signup");
            setError(null);
            setInfo(null);
          }}
          className="mt-6 w-full text-center text-sm font-semibold text-white/70 transition-colors hover:text-white"
        >
          {isSignup ? "Hai già un account? Accedi" : "Non hai un account? Creane uno"}
        </button>
      </div>

      <Link href="/" className="relative z-10 mt-6 text-center text-sm font-semibold text-white/55 transition-colors hover:text-white">
        ← Torna al sito
      </Link>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
