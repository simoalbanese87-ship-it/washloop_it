"use client";

import { useLead, type PlanCode } from "./LeadContext";

/** Card dei piani, SENZA prezzi: questa pagina raccoglie lead, non vende.
 *  Il bottone preseleziona il piano nel form e porta lì l'utente — non apre
 *  il checkout. */

type Plan = {
  code: PlanCode;
  volume: string;
  who: string;
  popular?: boolean;
};

const FEATURES = [
  "Ritiro fisso nel giorno scelto",
  "Lavaggio e stiraggio professionali",
  "Consegna entro 3 giorni feriali",
  "Scelta della fragranza preferita",
];

const PLANS: Plan[] = [
  { code: "S", volume: "1 sacco a settimana · ~6 kg", who: "Per single e giovani coppie che vogliono liberare il weekend." },
  { code: "M", volume: "2 sacchi a settimana", who: "Per professionisti e famiglie con una routine di capi costante.", popular: true },
  { code: "L", volume: "3 sacchi a settimana", who: "Per grandi carichi e per chi delega davvero la gestione del guardaroba." },
];

function Check() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none text-cyan">
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

export function PlanCards() {
  const { goToForm } = useLead();

  return (
    <div className="mt-12 grid gap-6 md:grid-cols-3">
      {PLANS.map((p) => (
        <article
          key={p.code}
          className={
            "relative flex flex-col rounded-[24px] border bg-white p-7 " +
            (p.popular ? "border-cyan shadow-[var(--shadow-cy)] md:-translate-y-3" : "border-line shadow-[var(--shadow-sm)]")
          }
        >
          {p.popular && (
            <span className="absolute -top-3 left-7 rounded-full bg-grad px-3 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-white">
              Più scelto
            </span>
          )}
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Piano</div>
          <div className="mt-1 font-display text-5xl font-black leading-none text-navy">{p.code}</div>
          <div className="mt-3 font-display text-sm font-extrabold text-navy">{p.volume}</div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{p.who}</p>

          <ul className="mt-5 flex-1 space-y-2.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-2 text-sm font-semibold text-navy">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => goToForm({ plan: p.code })}
            className={
              "mt-7 inline-flex min-h-[48px] items-center justify-center rounded-[40px] px-6 font-display text-[15px] font-extrabold transition-all " +
              (p.popular
                ? "bg-grad text-white shadow-[var(--shadow-cy)] hover:brightness-105"
                : "border-2 border-navy/25 text-navy hover:bg-navy/5")
            }
          >
            Scegli Piano {p.code}
          </button>
        </article>
      ))}
    </div>
  );
}
