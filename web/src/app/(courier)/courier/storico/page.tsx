import { Card, PageTitle } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { OrderStatus } from "@/lib/orders";

type Row = {
  id: string;
  status: OrderStatus;
  created_at: string;
  customer: { full_name: string | null } | null;
  addresses: { zones: { name: string } | null } | null;
};

export default async function CourierStorico() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("id, status, created_at, customer:profiles!orders_customer_id_fkey(full_name), addresses(zones(name))")
    .eq("courier_id", profile?.id ?? "")
    .in("status", ["picked_up", "at_laundry", "washing", "ready", "delivered", "completed"])
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<Row[]>();

  const rows = data ?? [];

  return (
    <>
      <PageTitle kicker="Storico" title="I tuoi giri" sub={`${rows.length} ordini gestiti`} />
      {rows.length === 0 ? (
        <Card><p className="text-sm font-medium text-muted">Ancora niente nello storico.</p></Card>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-line bg-white">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-line px-6 py-4 last:border-0">
              <div>
                <div className="font-display text-sm font-bold text-navy">{r.customer?.full_name ?? "Cliente"}</div>
                <div className="text-xs font-medium text-muted">
                  {r.addresses?.zones?.name ?? "—"} · {new Date(r.created_at).toLocaleDateString("it-IT")}
                </div>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
