import Link from "next/link";
import { PageTitle } from "@/components/app/AppShell";
import { OrdersBoard, type BoardOrder } from "@/components/app/OrdersBoard";
import { ArchiveList, type ArchiveRow } from "@/components/app/ArchiveList";
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
  customer: { full_name: string | null; phone: string | null; is_test: boolean } | null;
  addresses: { zones: { name: string } | null } | null;
  laundries: { name: string } | null;
  courier: { full_name: string | null } | null;
  pickup_slot: { starts_at: string } | null;
  delivery_slot: { starts_at: string } | null;
};
type Opt = { id: string; name: string };

export default async function AdminBoard({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string; filtro?: string; stato?: string; prova?: string }>;
}) {
  const { ok, warn, filtro, stato, prova } = await searchParams;
  const includiProva = prova === "1";
  const supabase = await createClient();

  // Gli ordini chiusi erano una pagina a sé ("Archivio"), e "consegnati"
  // compariva in due posti. Ora sono un filtro di questa: stessa lista, stesso
  // indirizzo, nessun dubbio su dove cercare un ordine.
  if (stato === "conclusi") {
    const { data: chiusi } = await supabase
      .from("orders")
      .select("id, status, created_at, bags, customer:profiles!orders_customer_id_fkey(full_name), addresses(zones(name)), laundries(name), courier:profiles!orders_courier_id_fkey(full_name)")
      .in("status", ["delivered", "completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<{ id: string; status: OrderStatus; created_at: string; bags: number; customer: { full_name: string | null } | null; addresses: { zones: { name: string } | null } | null; laundries: { name: string } | null; courier: { full_name: string | null } | null }[]>();

    const lista: ArchiveRow[] = (chiusi ?? []).map((r) => ({
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
        <PageTitle kicker="Ordini" title="Conclusi" sub={`${lista.length} consegnati, completati o annullati`} />
        <div className="mb-4">
          <Link href="/admin/ordini" className="font-display text-sm font-bold text-blue hover:underline">← Torna agli ordini aperti</Link>
        </div>
        <ArchiveList rows={lista} />
      </>
    );
  }

  const [{ data: rows }, { data: couriers }, { data: laundries }, { data: zones }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, bags, created_at, eta_ready_at, courier_id, laundry_id, " +
          "customer:profiles!orders_customer_id_fkey(full_name, phone, is_test), " +
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

  // Gli ordini di prova non stanno nel board: erano i 5 di Mario Test, tutti
  // "in ritardo" dal 20 giugno, e riempivano i contatori di cose che nessuno
  // avrebbe mai sistemato.
  const visibili = (rows ?? []).filter((r) => includiProva || !r.customer?.is_test);

  const orders: BoardOrder[] = visibili.map((r) => ({
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle kicker="Operations" title="Board ordini" sub={`${orders.length} ordini aperti · aggiornamento in tempo reale${includiProva ? " · inclusi i dati di prova" : ""}`} />
        <div className="mt-1 flex flex-wrap items-center gap-4">
          <Link href={includiProva ? "/admin/ordini" : "/admin/ordini?prova=1"} className="font-display text-sm font-bold text-navy/55 hover:text-navy">
            {includiProva ? "Nascondi dati di prova" : "Mostra dati di prova"}
          </Link>
          <Link href="/admin/ordini?stato=conclusi" className="font-display text-sm font-bold text-blue hover:underline">Ordini conclusi →</Link>
        </div>
      </div>
      {ok && <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}
      <OrdersBoard orders={orders} couriers={courierOpts} laundries={laundries ?? []} zones={zones ?? []} filtroIniziale={filtro === "ritardo" || filtro === "da_assegnare" ? filtro : undefined} />
    </>
  );
}
