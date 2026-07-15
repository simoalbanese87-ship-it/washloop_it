"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { createOnboardingAddress } from "@/lib/actions/onboarding";
import { startCheckout } from "@/lib/actions/billing";
import { ACCESS_MODE_LABEL } from "@/lib/orders";
import { planRecap } from "@/lib/plan-copy";

export type WizPlan = { id: string; code: string; name: string; price_month_cents: number; pickups_per_week: number; turnaround_hours: number };

const eur = (c: number) => "€" + (c / 100).toLocaleString("it-IT");
const input =
  "h-[54px] w-full rounded-[18px] border-2 border-white/15 bg-white/[0.08] px-4 text-base font-semibold text-white placeholder:font-medium placeholder:text-white/45 outline-none transition-colors focus:border-cyan focus:bg-white/[0.12]";

const ArrowR = () => (<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
const ChevL = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>);
const Check = ({ size = 18 }: { size?: number }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>);
const Lock = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);

const TOTAL = 4; // register, address, plan, pay

export function OnboardingWizard({ plans, initialPlanCode }: { plans: WizPlan[]; initialPlanCode: string | null }) {
  const [step, setStep] = useState(0); // 0 welcome, 1 register, 2 address, 3 plan, 4 pay
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);

  const [street, setStreet] = useState("");
  const [civico, setCivico] = useState("");
  const [cap, setCap] = useState("");
  const [city, setCity] = useState("Milano");
  const [intercom, setIntercom] = useState("");
  const [floor, setFloor] = useState("");
  const [accessMode, setAccessMode] = useState<"door" | "home" | "concierge">("door");
  const [accessNote, setAccessNote] = useState("");
  const [conciergeHours, setConciergeHours] = useState("");

  const initial = plans.find((p) => p.code === initialPlanCode);
  const [planId, setPlanId] = useState(initial?.id ?? plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId);

  async function doRegister() {
    if (!accepted) return setError("Devi accettare i Termini e la Privacy per continuare.");
    setLoading(true); setError(null); setInfo(null);
    const supabase = createClient();
    const acceptedAt = new Date().toISOString();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone, terms_accepted_at: acceptedAt } } });
    if (error) { setLoading(false); return setError(error.message); }
    if (data.session && data.user) {
      // Prova del consenso anche sul profilo (GDPR)
      await supabase.from("profiles").update({ terms_accepted_at: acceptedAt }).eq("id", data.user.id);
      setLoading(false); setStep(2); return;
    }
    setLoading(false);
    setInfo("Account creato. Conferma l'email, poi accedi per completare.");
  }

  async function doAddress() {
    if (!street.trim()) return setError("Inserisci la via");
    if (!civico.trim()) return setError("Inserisci il numero civico");
    if (accessMode === "concierge") {
      if (!accessNote.trim()) return setError("Inserisci il nome del portinaio");
      if (!conciergeHours.trim()) return setError("Inserisci l'orario della portineria");
    } else {
      if (!intercom.trim()) return setError("Inserisci il citofono");
      if (!floor.trim()) return setError("Inserisci il piano");
    }
    setLoading(true); setError(null);
    const res = await createOnboardingAddress({
      street, civico, cap, city, access_mode: accessMode,
      intercom: accessMode !== "concierge" ? intercom.trim() || null : null,
      floor: accessMode !== "concierge" ? floor.trim() || null : null,
      access_note: accessMode === "concierge" ? accessNote.trim() || null : accessNote.trim() || null,
      concierge_hours: accessMode === "concierge" ? conciergeHours.trim() || null : null,
    });
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setStep(3);
  }

  const back = () => (step <= 1 ? setStep(0) : setStep(step - 1));

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden px-6 py-8 text-white"
      style={{ background: "radial-gradient(120% 90% at 78% 0%, #2a4a8e 0%, #1B2D5E 52%, #142046 100%)" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="wl-bubble absolute h-28 w-28" style={{ left: "8%", top: "12%", animation: "wl-float 7s ease-in-out infinite" }} />
        <div className="wl-bubble absolute h-16 w-16" style={{ right: "12%", top: "28%", animation: "wl-float 9s ease-in-out infinite" }} />
        <div className="wl-bubble absolute h-20 w-20" style={{ right: "20%", bottom: "10%", animation: "wl-float 8s ease-in-out infinite" }} />
      </div>

      {/* WELCOME */}
      {step === 0 ? (
        <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <Logo variant="white" payoff size={44} />
          <div className="mt-8 inline-flex items-center gap-2 self-start rounded-full border border-cyan/30 bg-cyan/[0.13] px-4 py-1.5 font-display text-[12px] font-extrabold uppercase tracking-[0.12em] text-cyan">
            <span className="h-2 w-2 rounded-full bg-cyan" /> Milano · attivo
          </div>
          <h1 className="mt-5 font-display text-[34px] font-black leading-[1.06] tracking-[-0.02em]">
            Il tuo bucato,<br />gestito da <span className="text-cyan">professionisti</span>.
          </h1>
          <p className="mt-3.5 text-base font-medium leading-relaxed text-white/72">
            Ritiriamo, laviamo, stiriamo e riconsegniamo. Tu pensi a vivere — al resto pensiamo noi.
          </p>
          <button onClick={() => setStep(1)} className="mt-8 flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)]">
            Inizia ora <ArrowR />
          </button>
          <Link href="/login" className="mt-3 flex h-[54px] w-full items-center justify-center rounded-full border-2 border-white/25 font-display text-base font-extrabold text-white">
            Ho già un account
          </Link>
        </div>
      ) : (
        <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col">
          {/* progress */}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={back} aria-label="Indietro" className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white/10 text-white">
              <ChevL />
            </button>
            <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-gradient-to-r from-blue to-cyan transition-[width] duration-500" style={{ width: `${(step / TOTAL) * 100}%` }} />
            </div>
            <span className="flex-none font-display text-xs font-extrabold text-white/70">{step}/{TOTAL}</span>
          </div>

          {/* STEP 1 — REGISTER */}
          {step === 1 && (
            <div className="mt-7 flex-1">
              <div className="font-display text-[12px] font-extrabold uppercase tracking-[0.18em] text-cyan">Crea il tuo account</div>
              <h2 className="mt-2.5 font-display text-[30px] font-black leading-[1.08]">Iniziamo<br />da te.</h2>
              <p className="mt-2.5 text-[15px] font-medium text-white/70">Bastano pochi dati. Niente impegni — disdici quando vuoi.</p>
              <div className="mt-6 space-y-3">
                <input className={input} placeholder="Nome e cognome" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <input className={input} type="email" autoComplete="email" placeholder="tu@email.it" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className={input} placeholder="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <input className={input} type="password" minLength={8} autoComplete="new-password" placeholder="Password (min 8 caratteri)" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-[13px] font-medium leading-relaxed text-white">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[#00c8f0]" />
                <span>Accetto i <Link href="/termini" className="font-bold underline">Termini</Link> e la <Link href="/privacy" className="font-bold underline">Privacy policy</Link> del servizio.</span>
              </label>
            </div>
          )}

          {/* STEP 2 — ADDRESS + DELIVERY */}
          {step === 2 && (
            <div className="mt-7 flex-1">
              <div className="font-display text-[12px] font-extrabold uppercase tracking-[0.18em] text-cyan">Dove ritiriamo</div>
              <h2 className="mt-2.5 font-display text-[30px] font-black leading-[1.08]">Il tuo<br />indirizzo.</h2>
              <p className="mt-2.5 text-[15px] font-medium text-white/70">Serviamo tutta Milano. Dove passiamo a ritirare?</p>
              <div className="mt-6 space-y-3">
                <input className={input} placeholder="Via / indirizzo" value={street} onChange={(e) => setStreet(e.target.value)} />
                <div className="flex gap-3">
                  <input className={`${input} flex-1`} placeholder="Civico" value={civico} onChange={(e) => setCivico(e.target.value)} />
                  <input className={`${input} flex-1`} placeholder="CAP" value={cap} onChange={(e) => setCap(e.target.value)} />
                </div>
                <input className={input} placeholder="Città" value={city} onChange={(e) => setCity(e.target.value)} />
                <div className="pt-1 font-display text-[12px] font-extrabold uppercase tracking-[0.08em] text-white/60">Come ritiriamo il sacco?</div>
                {(["door", "home", "concierge"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setAccessMode(m)}
                    className={`flex w-full items-center gap-3 rounded-[16px] border-2 px-4 py-3.5 text-left transition-all ${accessMode === m ? "border-cyan bg-white/[0.1]" : "border-white/15 bg-white/[0.05]"}`}
                  >
                    <span className={`grid h-6 w-6 flex-none place-items-center rounded-full border-2 ${accessMode === m ? "border-cyan bg-cyan text-navy" : "border-white/30"}`}>
                      {accessMode === m && <Check size={14} />}
                    </span>
                    <span className="font-display text-[15px] font-extrabold text-white">{ACCESS_MODE_LABEL[m]}</span>
                  </button>
                ))}
                {accessMode !== "concierge" ? (
                  <div className="flex gap-3">
                    <input className={`${input} flex-1`} placeholder="Citofono" value={intercom} onChange={(e) => setIntercom(e.target.value)} />
                    <input className={`${input} flex-1`} placeholder="Piano" value={floor} onChange={(e) => setFloor(e.target.value)} />
                  </div>
                ) : (
                  <>
                    <input className={input} placeholder="Nome del portinaio" value={accessNote} onChange={(e) => setAccessNote(e.target.value)} />
                    <input className={input} placeholder="Orario portineria" value={conciergeHours} onChange={(e) => setConciergeHours(e.target.value)} />
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 — PLAN */}
          {step === 3 && (
            <div className="mt-7 flex-1">
              <div className="font-display text-[12px] font-extrabold uppercase tracking-[0.18em] text-cyan">Il tuo abbonamento</div>
              <h2 className="mt-2.5 font-display text-[30px] font-black leading-[1.08]">Scegli il<br />tuo piano.</h2>
              <p className="mt-2.5 text-[15px] font-medium text-white/70">Cambia o disdici quando vuoi dall&apos;app.</p>
              <div className="mt-6 space-y-3">
                {plans.map((p) => {
                  const on = p.id === planId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPlanId(p.id)}
                      className={`block w-full rounded-[20px] border-2 p-5 text-left transition-all ${on ? "border-cyan bg-white/[0.1]" : "border-white/15 bg-white/[0.05]"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-display text-lg font-black text-white">{p.name}</div>
                        <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${on ? "border-cyan bg-cyan text-navy" : "border-white/30"}`}>{on && <Check size={14} />}</span>
                      </div>
                      <div className="mt-1 flex items-end gap-1">
                        <span className="font-display text-[32px] font-black tracking-[-0.03em] text-white">{eur(p.price_month_cents)}</span>
                        <span className="mb-1.5 text-sm font-semibold text-white/55">/mese</span>
                      </div>
                      <div className="mt-1 text-sm font-medium text-white/65">{planRecap(p.code) ?? `Ritiro 1 volta a settimana · pronto in ${p.turnaround_hours}h · ritiro e consegna inclusi`}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4 — PAY */}
          {step === 4 && (
            <div className="mt-7 flex-1">
              <div className="font-display text-[12px] font-extrabold uppercase tracking-[0.18em] text-cyan">Pagamento sicuro</div>
              <h2 className="mt-2.5 font-display text-[30px] font-black leading-[1.08]">Attiva<br />l&apos;abbonamento.</h2>
              <p className="mt-2.5 text-[15px] font-medium text-white/70">Primo addebito oggi, poi ogni mese. Disdici quando vuoi.</p>
              <div className="mt-6 rounded-[18px] border border-white/15 bg-white/[0.07] p-5">
                <div className="flex items-center justify-between py-2 text-[15px]">
                  <span className="font-medium text-white/65">Piano {plan?.name}</span>
                  <span className="font-display font-extrabold text-white">{plan ? eur(plan.price_month_cents) : "—"}/mese</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/12 py-2 text-[15px]">
                  <span className="font-medium text-white/65">Attivazione</span>
                  <span className="font-display font-extrabold text-[#5ce6a8]">Gratis</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/12 pt-3 text-[15px]">
                  <span className="font-display font-extrabold text-white">Oggi paghi</span>
                  <span className="font-display text-xl font-black text-white">{plan ? eur(plan.price_month_cents) : "—"}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-white/60"><Lock /> Pagamento protetto · Stripe</div>
            </div>
          )}

          {/* error/info */}
          {error && <p className="mt-3 text-sm font-semibold text-[#ff9b8f]">{error}</p>}
          {info && (
            <div className="mt-3 rounded-[14px] border border-cyan/30 bg-cyan/10 p-3 text-sm font-semibold text-cyan">
              {info} <Link href="/login" className="underline">Vai all&apos;accesso →</Link>
            </div>
          )}

          {/* CTA dock */}
          <div className="pt-5">
            {step === 1 && (
              <button onClick={doRegister} disabled={loading} className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)] disabled:opacity-40">
                {loading ? "Attendi…" : <>Continua <ArrowR /></>}
              </button>
            )}
            {step === 2 && (
              <button onClick={doAddress} disabled={loading} className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)] disabled:opacity-40">
                {loading ? "Salvo…" : <>Continua <ArrowR /></>}
              </button>
            )}
            {step === 3 && (
              <button onClick={() => setStep(4)} disabled={!planId} className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)] disabled:opacity-40">
                Continua col piano {plan?.name} <ArrowR />
              </button>
            )}
            {step === 4 && (
              <form action={startCheckout}>
                <input type="hidden" name="plan_id" value={planId} />
                <button type="submit" className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)]">
                  <Lock /> Paga {plan ? eur(plan.price_month_cents) : ""} e attiva
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
