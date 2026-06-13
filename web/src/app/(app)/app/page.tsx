import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { OrderStatus } from "@/lib/orders";

type OrderRow = { id: string; status: OrderStatus; created_at: string; bags: number };
type SubRow = { status: string; current_period_end: string | null; plans: { name: string } | null };

export default async function Dashboard() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: sub }, { data: orders }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, current_period_end, plans(name)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SubRow>(),
    supabase
      .from("orders")
      .select("id, status, created_at, bags")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<OrderRow[]>(),
  ]);

  const active = sub?.status === "active" || sub?.status === "trialing";

  return (
    <>
      <PageTitle kicker={`Ciao ${profile?.full_name ?? ""}`.trim()} title="La tua dashboard" sub="Tutto il tuo bucato, sotto controllo." />

      <div className="grid gap-5 md:grid-cols-3">
        {/* Abbonamento */}
        <Card className="md:col-span-1">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-blue">Abbonamento</div>
          {active ? (
            <>
              <div className="mt-2 font-display text-2xl font-black text-navy">{sub?.plans?.name ?? "Attivo"}</div>
              <p className="mt-1 text-sm font-medium text-muted">
                {sub?.current_period_end
                  ? `Rinnovo il ${new Date(sub.current_period_end).toLocaleDateString("it-IT")}`
                  : "Abbonamento attivo"}
              </p>
            </>
          ) : (
            <>
              <div className="mt-2 font-display text-xl font-black text-navy">Non ancora attivo</div>
              <p className="mt-1 text-sm font-medium text-muted">Attiva un piano per iniziare a prenotare i ritiri.</p>
              <ButtonLink href="/app/abbonamento" size="md" className="mt-4 w-full">
                Scegli il piano →
              </ButtonLink>
            </>
          )}
        </Card>

        {/* Azione rapida */}
        <Card className="flex flex-col justify-between bg-navy text-white md:col-span-2">
          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-cyan">Prossimo passo</div>
            <div className="mt-2 font-display text-2xl font-black">Prenota un ritiro</div>
            <p className="mt-1 text-sm font-medium text-white/65">
              Scegli giorno e fascia: passiamo noi sotto casa. {active ? "" : "Serve un abbonamento attivo."}
            </p>
          </div>
          <ButtonLink href={active ? "/app/prenota" : "/app/abbonamento"} variant="light" className="mt-5 w-fit">
            {active ? "Prenota ritiro →" : "Attiva abbonamento →"}
          </ButtonLink>
        </Card>
      </div>

      {/* Ordini recenti */}
      <div className="mt-8">
        <h2 className="mb-4 font-display text-lg font-extrabold text-navy">Ordini recenti</h2>
        {orders && orders.length > 0 ? (
          <div className="overflow-hidden rounded-[24px] border border-line bg-white">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/app/ordini/${o.id}`}
                className="flex items-center justify-between border-b border-line px-6 py-4 transition-colors last:border-0 hover:bg-ice"
              >
                <div>
                  <div className="font-display text-sm font-bold text-navy">Ordine #{o.id.slice(0, 8)}</div>
                  <div className="text-xs font-medium text-muted">
                    {new Date(o.created_at).toLocaleDateString("it-IT")} · {o.bags} {o.bags === 1 ? "busta" : "buste"}
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm font-medium text-muted">Nessun ordine ancora. Quando prenoti un ritiro lo trovi qui.</p>
          </Card>
        )}
      </div>
    </>
  );
}
