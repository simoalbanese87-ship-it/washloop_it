"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { submitLead, type LeadFormState } from "@/lib/actions/leads";
import { useLead, type PlanCode } from "./LeadContext";

/** Form di raccolta lead. Non porta al checkout: raccoglie la richiesta e basta.
 *  CAP e piano arrivano dal contesto (hero + card piani). */

const PLANS: { code: PlanCode; label: string }[] = [
  { code: "S", label: "Piano S" },
  { code: "M", label: "Piano M" },
  { code: "L", label: "Piano L" },
];

const field =
  "min-h-[48px] w-full rounded-[14px] border border-line bg-ice px-4 text-base font-semibold text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-blue";
const label = "mb-1.5 block font-display text-xs font-extrabold uppercase tracking-[0.12em] text-navy/60";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[40px] bg-grad px-7 font-display text-base font-extrabold text-white shadow-[var(--shadow-cy)] transition-all hover:brightness-105 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? "Invio in corso…" : "Verifica disponibilità →"}
    </button>
  );
}

export function LeadForm({ utm }: { utm: { source: string; medium: string; campaign: string } }) {
  const { cap, setCap, plan, setPlan } = useLead();
  const [state, formAction] = useActionState<LeadFormState, FormData>(submitLead, { error: null });

  return (
    <form action={formAction} className="rounded-[24px] border border-line bg-white p-6 shadow-[var(--shadow-md)] sm:p-8">
      {/* Honeypot: invisibile agli umani, irresistibile per i bot. */}
      <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
        <label htmlFor="azienda">Azienda</label>
        <input id="azienda" name="azienda" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="utm_source" value={utm.source} />
      <input type="hidden" name="utm_medium" value={utm.medium} />
      <input type="hidden" name="utm_campaign" value={utm.campaign} />

      <div className="space-y-4">
        <div>
          <label htmlFor="lead-name" className={label}>Nome e cognome</label>
          <input id="lead-name" name="full_name" type="text" required autoComplete="name" placeholder="Es. Federica Rossi" className={field} />
        </div>

        <div>
          <label htmlFor="lead-email" className={label}>Email</label>
          <input id="lead-email" name="email" type="email" required autoComplete="email" placeholder="nome@email.it" className={field} />
        </div>

        <div>
          <label htmlFor="lead-phone" className={label}>Telefono</label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="349 1234567"
            className={field}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lead-cap" className={label}>CAP</label>
            <input
              id="lead-cap"
              name="cap"
              type="text"
              required
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              pattern="\d{5}"
              placeholder="20121"
              value={cap}
              onChange={(e) => setCap(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="lead-plan" className={label}>Piano preferito</label>
            <select
              id="lead-plan"
              name="plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlanCode)}
              className={`${field} cursor-pointer`}
            >
              {PLANS.map((p) => (
                <option key={p.code} value={p.code}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm font-medium leading-relaxed text-muted">
          <input type="checkbox" name="privacy" required className="mt-0.5 h-5 w-5 flex-none accent-[#00c8f0]" />
          <span>
            Ho letto la{" "}
            <Link href="/privacy" className="font-bold text-blue underline">Privacy Policy</Link>{" "}
            e acconsento al trattamento dei miei dati per essere ricontattato sulla disponibilità del servizio.
          </span>
        </label>

        {state.error && (
          <p role="alert" aria-live="polite" className="rounded-[12px] bg-[#C0392B]/10 px-4 py-3 text-sm font-semibold text-[#C0392B]">
            {state.error}
          </p>
        )}

        <SubmitButton />
      </div>
    </form>
  );
}
