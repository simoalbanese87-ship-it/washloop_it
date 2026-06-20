import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { advanceStatus, assignOrder, setEta } from "@/lib/actions/orders";
import { setStaffNotes, cancelOrder } from "@/lib/actions/items";
import { chargeOrderSpecials } from "@/lib/actions/charge";
import { AdminItems, type Item } from "@/components/app/AdminItems";
import { ORDER_FLOW, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";
import { fmtFull, toRomeInputValue } from "@/lib/format";

type Order = {
  id: string;
  status: OrderStatus;
  bags: number;
  notes: string | null;
  staff_notes: string | null;
  created_at: string;
  courier_id: string | null;
  laundry_id: string | null;
  eta_ready_at: string | null;
  customer: { full_name: string | null; phone: string | null } | null;
  addresses: { street: string; intercom: string | null; floor: string | null; zones: { name: string } | null } | null;
};

type Event = { id: string; status: OrderStatus; created_at: string; note: string | null };
type Person = { id: string; full_name: string | null };
type Laundry = { id: string; name: string };
type Special = { id: string; item_name: string; qty: number; price_cli_cents: number; charged_at: string | null };

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";
const STATUSES: OrderStatus[] = [...ORDER_FLOW, "cancelled"];
const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: events }, { data: couriers }, { data: laundries }, { data: items }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, bags, notes, staff_notes, created_at, courier_id, laundry_id, eta_ready_at, customer:profiles!orders_customer_id_fkey(full_name, phone), addresses(street, intercom, floor, zones(name))")
      .eq("id", id)
      .maybeSingle<Order>(),
    supabase.from("order_events").select("id, status, created_at, note").eq("order_id", id).order("created_at", { ascending: false }).returns<Event[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "courier").returns<Person[]>(),
    supabase.from("laundries").select("id, name").eq("active", true).returns<Laundry[]>(),
    supabase.from("order_items").select("id, kind, status, photo_url").eq("order_id", id).order("created_at").returns<Item[]>(),
  ]);

  const { data: specials } = await supabase
    .from("order_specials")
    .select("id, item_name, qty, price_cli_cents, charged_at")
    .eq("order_id", id)
    .order("created_at")
    .returns<Special[]>();

  if (!order) notFound();

  const specialRows = specials ?? [];
  const pendingTotal = specialRows.filter((s) => !s.charged_at).reduce((t, s) => t + s.price_cli_cents * s.qty, 0);

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
              <div>{order.bags} {order.bags === 1 ? "busta" : "buste"} · {fmtFull(order.created_at)}</div>
              {order.notes && <div>Note: {order.notes}</div>}
            </div>
            <a href={`/admin/ordini/${order.id}/etichetta`} className="mt-3 inline-block font-display text-sm font-bold text-blue hover:underline">
              🖨 Etichetta pacco
            </a>
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
            <span className="font-display text-sm font-extrabold text-navy">Pronto previsto (ETA)</span>
            <p className="mt-1 text-xs font-medium text-muted">Quando saranno pronti i capi. Il cliente lo vede nel tracking.</p>
            <form action={setEta} className="mt-3 flex gap-3">
              <input type="hidden" name="order_id" value={order.id} />
              <input type="datetime-local" name="eta_ready_at" defaultValue={toRomeInputValue(order.eta_ready_at)} className={input} />
              <Button type="submit" size="md" variant="ghost-navy">
                Salva ETA
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

          <Card>
            <AdminItems orderId={order.id} items={items ?? []} />
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-extrabold text-navy">Capi speciali (addebito cliente)</span>
              {pendingTotal > 0 && <span className="font-display text-sm font-black text-navy">{eur(pendingTotal)} da addebitare</span>}
            </div>
            {specialRows.length === 0 ? (
              <p className="mt-3 text-sm font-medium text-muted">Nessun capo speciale su questo ordine.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {specialRows.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-ice px-3 py-2 text-sm">
                    <span className="font-semibold text-navy">{s.qty}× {s.item_name}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-display font-bold text-navy">{eur(s.price_cli_cents * s.qty)}</span>
                      {s.charged_at ? (
                        <span className="rounded-full bg-[#1F8A5B]/15 px-2 py-0.5 font-display text-xs font-extrabold text-[#1F8A5B]">addebitato</span>
                      ) : (
                        <span className="rounded-full bg-[#E08A00]/15 px-2 py-0.5 font-display text-xs font-extrabold text-[#E08A00]">in attesa</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {pendingTotal > 0 && (
              <form action={chargeOrderSpecials} className="mt-3">
                <input type="hidden" name="order_id" value={order.id} />
                <Button type="submit" size="md" className="w-full">Addebita {eur(pendingTotal)} sulla carta del cliente</Button>
              </form>
            )}
          </Card>

          <Card>
            <span className="font-display text-sm font-extrabold text-navy">Note interne</span>
            <p className="mt-1 text-xs font-medium text-muted">Visibili solo allo staff, mai al cliente.</p>
            <form action={setStaffNotes} className="mt-3 space-y-2">
              <input type="hidden" name="order_id" value={order.id} />
              <textarea name="staff_notes" rows={3} defaultValue={order.staff_notes ?? ""} placeholder="Es. macchia ostinata sul colletto…" className={`${input} h-auto py-2`} />
              <Button type="submit" size="md" variant="ghost-navy">Salva note</Button>
            </form>
          </Card>

          {order.status !== "cancelled" && order.status !== "delivered" && order.status !== "completed" && (
            <form action={cancelOrder}>
              <input type="hidden" name="order_id" value={order.id} />
              <button type="submit" className="font-display text-sm font-bold text-[#C0392B] hover:underline">
                Annulla ordine
              </button>
            </form>
          )}
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
                  <div className="text-xs font-medium text-muted">{fmtFull(e.created_at)}</div>
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
