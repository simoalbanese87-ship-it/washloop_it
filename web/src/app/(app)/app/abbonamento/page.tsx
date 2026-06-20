import { createClient } from "@/lib/supabase/server";
import { startCheckout, openPortal } from "@/lib/actions/billing";
import { fmtDate } from "@/lib/format";

type Plan = { id: string; code: string; name: string; price_month_cents: number; pickups_per_week: number; turnaround_hours: number };
type Sub = { status: string; current_period_end: string | null; plan_id: string | null; plans: { name: string } | null };

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT");

const STATUS_LABEL: Record<string, string> = {
  active: "Attivo",
  trialing: "In prova",
  past_due: "Pagamento in sospeso",
  unpaid: "Non pagato",
  canceled: "Disdetto",
  paused: "In pausa",
  incomplete: "Da completare",
};

export default async function AbbonamentoPage({ searchParams }: { searchParams: Promise<{ need?: string }> }) {
  const supabase = await createClient();
  const [{ need }, { data: plans }, { data: sub }] = await Promise.all([
    searchParams,
    supabase.from("plans").select("id, code, name, price_month_cents, pickups_per_week, turnaround_hours").eq("active", true).order("sort").returns<Plan[]>(),
    supabase.from("subscriptions").select("status, current_period_end, plan_id, plans(name)").order("created_at", { ascending: false }).limit(1).maybeSingle<Sub>(),
  ]);

  const active = sub?.status === "active" || sub?.status === "trialing";

  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Abbonamento</div>
        <h1 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">Il tuo piano</h1>
        <p className="mt-1.5 text-sm font-medium text-muted">Cambia, metti in pausa o disdici quando vuoi.</p>
      </div>

      {need && !active && (
        <div className="rounded-[18px] border border-blue/30 bg-blue/5 p-4 text-sm font-semibold text-navy">
          Per prenotare un ritiro serve un abbonamento attivo. Scegli un piano qui sotto.
        </div>
      )}

      {/* Piano attivo */}
      {active && (
        <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#26417a] to-[#16264f] p-6 text-white shadow-[0_18px_44px_-26px_rgba(27,45,94,0.7)]">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-cyan/20 blur-2xl" />
          <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-cyan">Piano attivo</div>
          <div className="mt-1 font-display text-[24px] font-black leading-tight">{sub?.plans?.name ?? "Attivo"}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-white/65">
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-display text-xs font-bold text-cyan">{STATUS_LABEL[sub?.status ?? ""] ?? sub?.status}</span>
            {sub?.current_period_end && <span>Rinnovo il {fmtDate(sub.current_period_end)}</span>}
          </div>
          <form action={openPortal} className="mt-4">
            <button type="submit" className="inline-flex rounded-full bg-white/15 px-4 py-2 font-display text-sm font-extrabold text-white backdrop-blur transition-colors hover:bg-white/25">
              Gestisci abbonamento →
            </button>
          </form>
        </section>
      )}

      {/* Piani */}
      <div className="space-y-3">
        {(plans ?? []).map((p) => {
          const isCurrent = active && sub?.plan_id === p.id;
          return (
            <section key={p.id} className={`rounded-[22px] border bg-white p-5 ${isCurrent ? "border-cyan shadow-[0_18px_40px_-20px_rgba(0,200,240,0.45)]" : "border-line"}`}>
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-black text-navy">{p.name}</div>
                {isCurrent && <span className="rounded-full bg-cyan/15 px-2.5 py-0.5 font-display text-xs font-extrabold text-blue">Attuale</span>}
              </div>
              <div className="mt-2 flex items-end gap-1">
                <span className="font-display text-[34px] font-black tracking-[-0.03em] text-navy">€{euro(p.price_month_cents)}</span>
                <span className="mb-1.5 text-sm font-semibold text-muted">/mese</span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-muted">
                {p.pickups_per_week} {p.pickups_per_week === 1 ? "ritiro" : "ritiri"} a settimana · pronto in {p.turnaround_hours}h · ritiro e consegna inclusi
              </p>
              {isCurrent ? (
                <div className="mt-4 rounded-full border-2 border-line py-3 text-center font-display text-sm font-extrabold text-muted">Piano attuale</div>
              ) : active ? (
                <form action={openPortal} className="mt-4">
                  <button type="submit" className="w-full rounded-full border-2 border-line py-3 font-display text-sm font-extrabold text-navy">Passa a {p.name} →</button>
                </form>
              ) : (
                <form action={startCheckout} className="mt-4">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <button type="submit" className="w-full rounded-full bg-gradient-to-br from-blue to-cyan py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">Attiva {p.name} →</button>
                </form>
              )}
            </section>
          );
        })}
        {(!plans || plans.length === 0) && (
          <div className="rounded-[18px] border border-line bg-white p-5 text-sm font-medium text-muted">Piani non ancora disponibili.</div>
        )}
      </div>

      {/* Recesso/disdetta — discreto. Porta al Customer Portal Stripe. */}
      {active && (
        <div className="border-t border-line pt-5 text-center">
          <form action={openPortal}>
            <button type="submit" className="text-xs font-semibold text-muted underline-offset-2 hover:text-navy hover:underline">
              Recedi dal contratto / disdici l&apos;abbonamento
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-muted/80">
            La disdetta ferma il rinnovo automatico a fine periodo. Il periodo già pagato non è rimborsabile una volta avviato il servizio.
          </p>
        </div>
      )}
    </div>
  );
}
