import Link from "next/link";
import { PageTitle } from "@/components/app/AppShell";
import { createClient } from "@/lib/supabase/server";
import { ORDER_FLOW, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";

type Order = {
  id: string;
  status: OrderStatus;
  bags: number;
  created_at: string;
  customer: { full_name: string | null } | null;
  addresses: { street: string; zones: { name: string } | null } | null;
};

// Colonne board: raggruppo gli stati in fasi operative
const COLUMNS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "in_arrivo", label: "Da ritirare", statuses: ["requested", "pickup_scheduled"] },
  { key: "lavorazione", label: "In lavorazione", statuses: ["picked_up", "at_laundry", "washing"] },
  { key: "pronti", label: "Pronti / consegna", statuses: ["ready", "delivery_scheduled", "out_for_delivery"] },
  { key: "chiusi", label: "Consegnati", statuses: ["delivered", "completed"] },
];

export default async function AdminBoard() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, bags, created_at, customer:profiles!orders_customer_id_fkey(full_name), addresses(street, zones(name))")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .returns<Order[]>();

  const all = orders ?? [];

  return (
    <>
      <PageTitle kicker="Operations" title="Board ordini" sub={`${all.length} ordini attivi`} />

      <div className="grid gap-4 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = all.filter((o) => col.statuses.includes(o.status));
          return (
            <div key={col.key} className="rounded-[20px] bg-white/60 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="font-display text-sm font-extrabold text-navy">{col.label}</span>
                <span className="rounded-full bg-navy/10 px-2 py-0.5 font-display text-xs font-bold text-navy">{items.length}</span>
              </div>
              <div className="space-y-2.5">
                {items.map((o) => (
                  <Link
                    key={o.id}
                    href={`/admin/ordini/${o.id}`}
                    className="block rounded-[16px] border border-line bg-white p-4 shadow-[var(--shadow-sm)] transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-extrabold text-navy">#{o.id.slice(0, 8)}</span>
                      <span className="font-display text-[10px] font-bold uppercase tracking-wide text-blue">{ORDER_STATUS_LABEL[o.status]}</span>
                    </div>
                    <div className="mt-1.5 text-sm font-semibold text-navy/80">{o.customer?.full_name ?? "Cliente"}</div>
                    <div className="mt-0.5 text-xs font-medium text-muted">
                      {o.addresses?.zones?.name ?? "—"} · {o.bags} {o.bags === 1 ? "busta" : "buste"}
                    </div>
                  </Link>
                ))}
                {items.length === 0 && <div className="px-1 py-4 text-xs font-medium text-muted">Vuoto</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
