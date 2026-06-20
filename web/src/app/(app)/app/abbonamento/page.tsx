import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
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
    <>
      <PageTitle kicker="Abbonamento" title="Il tuo piano" sub="Cambia, metti in pausa o disdici quando vuoi." />

      {need && !active && (
        <Card className="mb-6 border-blue/30 bg-blue/5">
          <p className="text-sm font-semibold text-navy">
            Per prenotare un ritiro serve un abbonamento attivo. Scegli un piano qui sotto.
          </p>
        </Card>
      )}

      {active && (
        <Card className="mb-6 bg-navy text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-cyan">Piano attivo</div>
              <div className="mt-1 font-display text-2xl font-black">{sub?.plans?.name ?? "Attivo"}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-white/65">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-display text-xs font-bold text-cyan">{STATUS_LABEL[sub?.status ?? ""] ?? sub?.status}</span>
                {sub?.current_period_end && <span>Rinnovo il {fmtDate(sub.current_period_end)}</span>}
              </div>
            </div>
            <form action={openPortal}>
              <Button variant="light" size="md" type="submit">Gestisci abbonamento →</Button>
            </form>
          </div>
          <p className="mt-3 text-sm font-medium text-white/55">Dal pannello gestisci pagamento, cambio piano, pausa e disdetta.</p>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {(plans ?? []).map((p) => {
          const isCurrent = active && sub?.plan_id === p.id;
          return (
            <Card key={p.id} className={`flex flex-col ${isCurrent ? "ring-2 ring-cyan" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="font-display text-xl font-black text-navy">{p.name}</div>
                {isCurrent && <span className="rounded-full bg-cyan/15 px-2.5 py-0.5 font-display text-xs font-extrabold text-blue">Attuale</span>}
              </div>
              <div className="mt-3 flex items-end gap-1">
                <span className="font-display text-4xl font-black text-navy">€{euro(p.price_month_cents)}</span>
                <span className="mb-1 text-sm font-semibold text-muted">/mese</span>
              </div>
              <p className="mt-2 text-sm font-medium text-muted">
                {p.pickups_per_week} {p.pickups_per_week === 1 ? "ritiro" : "ritiri"} a settimana · pronto in {p.turnaround_hours}h · ritiro e consegna inclusi
              </p>
              {isCurrent ? (
                <Button size="md" variant="ghost-navy" className="mt-6 w-full" disabled>
                  Piano attuale
                </Button>
              ) : active ? (
                <form action={openPortal} className="mt-6">
                  <Button type="submit" size="md" variant="ghost-navy" className="w-full">Passa a {p.name} →</Button>
                </form>
              ) : (
                <form action={startCheckout} className="mt-6">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <Button type="submit" size="md" className="w-full">Attiva {p.name} →</Button>
                </form>
              )}
            </Card>
          );
        })}
        {(!plans || plans.length === 0) && (
          <Card className="md:col-span-3">
            <p className="text-sm font-medium text-muted">Piani non ancora disponibili.</p>
          </Card>
        )}
      </div>
    </>
  );
}
