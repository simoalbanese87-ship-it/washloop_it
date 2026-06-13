import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { startCheckout, openPortal } from "@/lib/actions/billing";

type Plan = { id: string; code: string; name: string; price_month_cents: number; pickups_per_week: number };
type Sub = { status: string; current_period_end: string | null; plans: { name: string } | null };

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT");

export default async function AbbonamentoPage() {
  const supabase = await createClient();
  const [{ data: plans }, { data: sub }] = await Promise.all([
    supabase.from("plans").select("id, code, name, price_month_cents, pickups_per_week").eq("active", true).order("sort").returns<Plan[]>(),
    supabase.from("subscriptions").select("status, current_period_end, plans(name)").order("created_at", { ascending: false }).limit(1).maybeSingle<Sub>(),
  ]);

  const active = sub?.status === "active" || sub?.status === "trialing";

  return (
    <>
      <PageTitle kicker="Abbonamento" title="Il tuo piano" sub="Cambia, metti in pausa o disdici quando vuoi." />

      {active && (
        <Card className="mb-6 flex items-center justify-between bg-navy text-white">
          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-cyan">Piano attivo</div>
            <div className="mt-1 font-display text-xl font-black">{sub?.plans?.name ?? "Attivo"}</div>
          </div>
          <form action={openPortal}>
            <Button variant="light" size="md" type="submit">
              Gestisci →
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {(plans ?? []).map((p) => (
          <Card key={p.id} className="flex flex-col">
            <div className="font-display text-xl font-black text-navy">{p.name}</div>
            <div className="mt-3 flex items-end gap-1">
              <span className="font-display text-4xl font-black text-navy">€{euro(p.price_month_cents)}</span>
              <span className="mb-1 text-sm font-semibold text-muted">/mese</span>
            </div>
            <p className="mt-2 text-sm font-medium text-muted">
              {p.pickups_per_week} {p.pickups_per_week === 1 ? "ritiro" : "ritiri"} a settimana · ritiro e consegna inclusi
            </p>
            <form action={startCheckout} className="mt-6">
              <input type="hidden" name="plan_id" value={p.id} />
              <Button type="submit" size="md" className="w-full">
                {active ? "Passa a " + p.name : "Attiva " + p.name} →
              </Button>
            </form>
          </Card>
        ))}
        {(!plans || plans.length === 0) && (
          <Card className="md:col-span-3">
            <p className="text-sm font-medium text-muted">Piani non ancora disponibili. Configura i prezzi su Stripe e popola `plans.stripe_price_id`.</p>
          </Card>
        )}
      </div>
    </>
  );
}
