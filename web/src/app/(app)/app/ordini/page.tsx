import { PageTitle } from "@/components/app/AppShell";
import { CustomerOrders, type CustOrder } from "@/components/app/CustomerOrders";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/orders";

type Row = {
  id: string;
  status: OrderStatus;
  created_at: string;
  bags: number;
  eta_ready_at: string | null;
  laundries: { name: string } | null;
};

export default async function OrdiniPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("orders")
    .select("id, status, created_at, bags, eta_ready_at, laundries(name)")
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  const list: CustOrder[] = (rows ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    bags: r.bags,
    eta_ready_at: r.eta_ready_at,
    laundry_name: r.laundries?.name ?? null,
  }));

  return (
    <>
      <PageTitle kicker="Ordini" title="I tuoi ordini" sub="Storico completo dei ritiri." />
      <CustomerOrders rows={list} />
    </>
  );
}
