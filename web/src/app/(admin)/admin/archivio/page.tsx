import { PageTitle } from "@/components/app/AppShell";
import { ArchiveList, type ArchiveRow } from "@/components/app/ArchiveList";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/orders";

type Row = {
  id: string;
  status: OrderStatus;
  created_at: string;
  bags: number;
  customer: { full_name: string | null } | null;
  addresses: { zones: { name: string } | null } | null;
  laundries: { name: string } | null;
  courier: { full_name: string | null } | null;
};

export default async function ArchivioPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("orders")
    .select(
      "id, status, created_at, bags, customer:profiles!orders_customer_id_fkey(full_name), addresses(zones(name)), laundries(name), courier:profiles!orders_courier_id_fkey(full_name)",
    )
    .in("status", ["delivered", "completed", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<Row[]>();

  const list: ArchiveRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    bags: r.bags,
    customer_name: r.customer?.full_name ?? null,
    zone_name: r.addresses?.zones?.name ?? null,
    laundry_name: r.laundries?.name ?? null,
    courier_name: r.courier?.full_name ?? null,
  }));

  return (
    <>
      <PageTitle kicker="Archivio" title="Ordini chiusi" sub={`${list.length} ordini consegnati / completati / annullati`} />
      <ArchiveList rows={list} />
    </>
  );
}
