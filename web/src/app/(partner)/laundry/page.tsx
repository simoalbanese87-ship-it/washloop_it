import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { advanceStatus } from "@/lib/actions/partner";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";
import { fmtFull } from "@/lib/format";

export const dynamic = "force-dynamic";

type PartnerOrder = {
  order_id: string;
  client_code: string | null;
  bags: number;
  service: string | null;
  fragrance: string | null;
  status: OrderStatus;
  eta_ready_at: string | null;
  created_at: string;
};

const COLUMNS: { key: string; title: string; statuses: OrderStatus[]; cta?: string }[] = [
  { key: "arrivo", title: "In arrivo", statuses: ["picked_up"] },
  { key: "arrivato", title: "Arrivato", statuses: ["at_laundry"] },
  { key: "lavoro", title: "In lavorazione", statuses: ["washing"] },
  { key: "pronti", title: "Pronti", statuses: ["ready"] },
];

const NEXT_CTA: Partial<Record<OrderStatus, string>> = {
  picked_up: "Segna arrivato",
  at_laundry: "Avvia lavaggio",
  washing: "Segna pronto",
};

function OrderCard({ o }: { o: PartnerOrder }) {
  const cta = NEXT_CTA[o.status];
  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/laundry/${o.order_id}`} className="font-display text-base font-black tracking-tight text-navy hover:text-blue">
          {o.client_code ?? "—"}
        </Link>
        <span className="rounded-full bg-ice px-2.5 py-1 font-display text-[10px] font-extrabold uppercase tracking-wider text-blue">
          {o.bags} {o.bags === 1 ? "sacco" : "sacchi"}
        </span>
      </div>

      <dl className="mt-2.5 space-y-1 text-sm font-medium text-muted">
        {o.service && <div>{o.service}</div>}
        {o.fragrance && <div>Profumo: {o.fragrance}</div>}
        {o.eta_ready_at && <div className="text-navy/70">Pronto entro: {fmtFull(o.eta_ready_at)}</div>}
      </dl>

      <div className="mt-3 flex items-center gap-2">
        <Link href={`/laundry/${o.order_id}`} className="font-display text-sm font-bold text-navy/55 hover:text-navy">
          Dettaglio
        </Link>
        {cta && (
          <form action={advanceStatus} className="ml-auto">
            <input type="hidden" name="order_id" value={o.order_id} />
            <Button type="submit" size="md" className="!min-h-[40px] !px-4 !text-sm">{cta}</Button>
          </form>
        )}
      </div>
    </Card>
  );
}

export default async function LaundryBoard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_orders")
    .select("order_id, client_code, bags, service, fragrance, status, eta_ready_at, created_at")
    .order("created_at", { ascending: true })
    .returns<PartnerOrder[]>();

  const rows = data ?? [];
  const active = rows.filter((r) => ["picked_up", "at_laundry", "washing", "ready"].includes(r.status));

  return (
    <>
      <PageTitle
        kicker="Portale lavanderia"
        title="Lavorazioni"
        sub={`${active.length} ordini attivi · solo dati operativi, nessun dato personale`}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = active.filter((r) => col.statuses.includes(r.status));
          return (
            <section key={col.key}>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold text-navy">
                {col.title}
                <span className="rounded-full bg-navy px-2 py-0.5 font-display text-[11px] font-bold text-cyan">{items.length}</span>
              </h2>
              <div className="space-y-3">
                {items.length > 0 ? (
                  items.map((o) => <OrderCard key={o.order_id} o={o} />)
                ) : (
                  <Card className="!p-4"><p className="text-sm font-medium text-muted">Nessun ordine.</p></Card>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {active.length === 0 && (
        <p className="mt-8 text-center text-sm font-medium text-muted">
          Nessuna lavorazione in corso. Gli ordini compaiono qui quando il corriere li ritira.
        </p>
      )}
    </>
  );
}
