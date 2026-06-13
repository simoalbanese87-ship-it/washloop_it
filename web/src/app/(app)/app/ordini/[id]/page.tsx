import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import { OrderTimeline } from "@/components/app/OrderTimeline";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { bookDelivery } from "@/lib/actions/orders";
import { statusIndex, type OrderStatus } from "@/lib/orders";

type Order = {
  id: string;
  status: OrderStatus;
  bags: number;
  notes: string | null;
  created_at: string;
  delivery_slot_id: string | null;
  laundry_id: string | null;
  eta_ready_at: string | null;
  addresses: { street: string; label: string | null } | null;
  laundries: { name: string } | null;
};
type Slot = { id: string; starts_at: string; ends_at: string };

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, bags, notes, created_at, delivery_slot_id, laundry_id, eta_ready_at, addresses(street, label), laundries(name)")
    .eq("id", id)
    .maybeSingle<Order>();

  if (!order) notFound();

  // Consegna prenotabile da "ready" in poi, se non già fissata
  const canBookDelivery = statusIndex(order.status) >= statusIndex("ready") && !order.delivery_slot_id;
  let deliverySlots: Slot[] = [];
  if (canBookDelivery) {
    const nowIso = new Date().toISOString();
    let q = supabase
      .from("slots")
      .select("id, starts_at, ends_at")
      .eq("kind", "delivery")
      .gte("starts_at", nowIso);
    if (order.laundry_id) q = q.eq("laundry_id", order.laundry_id);
    const { data } = await q.order("starts_at").limit(12).returns<Slot[]>();
    deliverySlots = data ?? [];
  }

  return (
    <>
      <PageTitle kicker={`Ordine #${order.id.slice(0, 8)}`} title="Stato del tuo bucato" />

      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-extrabold text-navy">Stato attuale</span>
            <StatusBadge status={order.status} />
          </div>
          <div className="mt-4 space-y-1.5 text-sm font-medium text-muted">
            <div>Ritiro: {order.addresses?.label ? `${order.addresses.label} — ` : ""}{order.addresses?.street}</div>
            {order.laundries?.name && <div>Lavanderia: {order.laundries.name}</div>}
            <div>{order.bags} {order.bags === 1 ? "busta" : "buste"} · creato il {new Date(order.created_at).toLocaleDateString("it-IT")}</div>
            {order.notes && <div>Note: {order.notes}</div>}
          </div>

          {order.eta_ready_at && statusIndex(order.status) < statusIndex("delivered") && (
            <div className="mt-4 rounded-[14px] border border-cyan/30 bg-cyan/10 px-4 py-3">
              <div className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-blue">Riceverai entro</div>
              <div className="mt-0.5 font-display text-base font-black text-navy">{fmt(order.eta_ready_at)}</div>
            </div>
          )}

          {canBookDelivery && (
            <div className="mt-6 border-t border-line pt-5">
              <div className="font-display text-sm font-extrabold text-navy">I tuoi capi sono pronti 🎉</div>
              <p className="mt-1 text-sm font-medium text-muted">Scegli quando riceverli a casa.</p>
              {deliverySlots.length > 0 ? (
                <form action={bookDelivery} className="mt-3 space-y-3">
                  <input type="hidden" name="order_id" value={order.id} />
                  <select name="delivery_slot_id" required className={input} defaultValue="">
                    <option value="" disabled>
                      Fascia di consegna…
                    </option>
                    {deliverySlots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {fmt(s.starts_at)}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="md" className="w-full">
                    Prenota consegna →
                  </Button>
                </form>
              ) : (
                <p className="mt-3 rounded-[14px] bg-ice p-3 text-sm font-medium text-muted">Nessuno slot di consegna disponibile al momento.</p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 font-display text-sm font-extrabold text-navy">Avanzamento</div>
          <OrderTimeline orderId={order.id} initialStatus={order.status} />
        </Card>
      </div>
    </>
  );
}
