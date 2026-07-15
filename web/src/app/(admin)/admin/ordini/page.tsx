import { PageTitle } from "@/components/app/AppShell";
import { OrdersBoard, type BoardOrder } from "@/components/app/OrdersBoard";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/orders";

type Row = {
  id: string;
  status: OrderStatus;
  bags: number;
  created_at: string;
  eta_ready_at: string | null;
  courier_id: string | null;
  laundry_id: string | null;
  customer: { full_name: string | null; phone: string | null } | null;
  addresses: { zones: { name: string } | null } | null;
  laundries: { name: string } | null;
  courier: { full_name: string | null } | null;
  pickup_slot: { starts_at: string } | null;
  delivery_slot: { starts_at: string } | null;
};
type Opt = { id: string; name: string };

export default async function AdminBoard({ searchParams }: { searchParams: Promise<{ ok?: string; warn?: string }> }) {
  const { ok, warn } = await searchParams;
  const supabase = await createClient();

  const [{ data: rows }, { data: couriers }, { data: laundries }, { data: zones }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, bags, created_at, eta_ready_at, courier_id, laundry_id, " +
          "customer:profiles!orders_customer_id_fkey(full_name, phone), " +
          "addresses(zones(name)), laundries(name), " +
          "courier:profiles!orders_courier_id_fkey(full_name), " +
          "pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at), " +
          "delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at)",
      )
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .returns<Row[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "courier").returns<{ id: string; full_name: string | null }[]>(),
    supabase.from("laundries").select("id, name").eq("active", true).returns<Opt[]>(),
    supabase.from("zones").select("id, name").eq("active", true).order("name").returns<Opt[]>(),
  ]);

  const orders: BoardOrder[] = (rows ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    bags: r.bags,
    created_at: r.created_at,
    eta_ready_at: r.eta_ready_at,
    courier_id: r.courier_id,
    laundry_id: r.laundry_id,
    customer_name: r.customer?.full_name ?? null,
    customer_phone: r.customer?.phone ?? null,
    zone_name: r.addresses?.zones?.name ?? null,
    laundry_name: r.laundries?.name ?? null,
    courier_name: r.courier?.full_name ?? null,
    pickup_at: r.pickup_slot?.starts_at ?? null,
    delivery_at: r.delivery_slot?.starts_at ?? null,
  }));

  const courierOpts: Opt[] = (couriers ?? []).map((c) => ({ id: c.id, name: c.full_name ?? c.id.slice(0, 6) }));

  return (
    <>
      <PageTitle kicker="Operations" title="Board ordini" sub={`${orders.length} ordini · aggiornamento in tempo reale`} />
      {ok && <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}
      <OrdersBoard orders={orders} couriers={courierOpts} laundries={laundries ?? []} zones={zones ?? []} />
    </>
  );
}
