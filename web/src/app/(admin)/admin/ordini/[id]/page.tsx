import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { advanceStatus, assignOrder } from "@/lib/actions/orders";
import { ORDER_FLOW, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";

type Order = {
  id: string;
  status: OrderStatus;
  bags: number;
  notes: string | null;
  created_at: string;
  courier_id: string | null;
  laundry_id: string | null;
  customer: { full_name: string | null; phone: string | null } | null;
  addresses: { street: string; intercom: string | null; floor: string | null; zones: { name: string } | null } | null;
};
type Event = { id: string; status: OrderStatus; created_at: string; note: string | null };
type Person = { id: string; full_name: string | null };
type Laundry = { id: string; name: string };

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";
const STATUSES: OrderStatus[] = [...ORDER_FLOW, "cancelled"];

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: events }, { data: couriers }, { data: laundries }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, bags, notes, created_at, courier_id, laundry_id, customer:profiles!orders_customer_id_fkey(full_name, phone), addresses(street, intercom, floor, zones(name))")
      .eq("id", id)
      .maybeSingle<Order>(),
    supabase.from("order_events").select("id, status, created_at, note").eq("order_id", id).order("created_at", { ascending: false }).returns<Event[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "courier").returns<Person[]>(),
    supabase.from("laundries").select("id, name").eq("active", true).returns<Laundry[]>(),
  ]);

  if (!order) notFound();

  return (
    <>
      <PageTitle kicker={`Ordine #${order.id.slice(0, 8)}`} title={order.customer?.full_name ?? "Cliente"} />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Colonna gestione */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-extrabold text-navy">Dettagli</span>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-4 space-y-1.5 text-sm font-medium text-muted">
              <div>Cliente: {order.customer?.full_name ?? "—"} {order.customer?.phone && `· ${order.customer.phone}`}</div>
              <div>Indirizzo: {order.addresses?.street} {order.addresses?.zones?.name && `(${order.addresses.zones.name})`}</div>
              {(order.addresses?.floor || order.addresses?.intercom) && (
                <div>{order.addresses?.floor && `Piano ${order.addresses.floor}`} {order.addresses?.intercom && `· Citofono ${order.addresses.intercom}`}</div>
              )}
              <div>{order.bags} {order.bags === 1 ? "busta" : "buste"} · {new Date(order.created_at).toLocaleString("it-IT")}</div>
              {order.notes && <div>Note: {order.notes}</div>}
            </div>
          </Card>

          <Card>
            <span className="font-display text-sm font-extrabold text-navy">Assegna</span>
            <form action={assignOrder} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="order_id" value={order.id} />
              <select name="courier_id" className={input} defaultValue={order.courier_id ?? ""}>
                <option value="">Corriere…</option>
                {(couriers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name ?? c.id.slice(0, 8)}</option>
                ))}
              </select>
              <select name="laundry_id" className={input} defaultValue={order.laundry_id ?? ""}>
                <option value="">Lavanderia…</option>
                {(laundries ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <Button type="submit" size="md" variant="ghost-navy" className="sm:col-span-2">
                Salva assegnazione
              </Button>
            </form>
          </Card>

          <Card>
            <span className="font-display text-sm font-extrabold text-navy">Avanza stato</span>
            <form action={advanceStatus} className="mt-3 flex gap-3">
              <input type="hidden" name="order_id" value={order.id} />
              <select name="status" className={input} defaultValue={order.status}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
                ))}
              </select>
              <Button type="submit" size="md">
                Aggiorna
              </Button>
            </form>
          </Card>
        </div>

        {/* Timeline eventi */}
        <Card>
          <span className="font-display text-sm font-extrabold text-navy">Cronologia</span>
          <ol className="mt-4 space-y-3">
            {(events ?? []).map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-blue" />
                <div>
                  <div className="font-display text-sm font-bold text-navy">{ORDER_STATUS_LABEL[e.status]}</div>
                  <div className="text-xs font-medium text-muted">{new Date(e.created_at).toLocaleString("it-IT")}</div>
                </div>
              </li>
            ))}
            {(!events || events.length === 0) && <li className="text-sm font-medium text-muted">Nessun evento.</li>}
          </ol>
        </Card>
      </div>
    </>
  );
}
