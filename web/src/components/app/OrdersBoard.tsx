"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { assignCourier, advanceStatus, bulkAssignCourier, autoAssignCouriers } from "@/lib/actions/orders";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ORDER_FLOW, ORDER_STATUS_LABEL, statusIndex, type OrderStatus } from "@/lib/orders";
import { fmtDateTime } from "@/lib/format";

export type BoardOrder = {
  id: string;
  status: OrderStatus;
  bags: number;
  created_at: string;
  eta_ready_at: string | null;
  courier_id: string | null;
  laundry_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  zone_name: string | null;
  laundry_name: string | null;
  courier_name: string | null;
  pickup_at: string | null;
  delivery_at: string | null;
};
type Opt = { id: string; name: string };

const COLUMNS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "pickup", label: "Da ritirare", statuses: ["requested", "pickup_scheduled"] },
  { key: "work", label: "In lavorazione", statuses: ["picked_up", "at_laundry", "washing"] },
  { key: "ready", label: "Pronti / consegna", statuses: ["ready", "delivery_scheduled", "out_for_delivery"] },
  { key: "done", label: "Consegnati", statuses: ["delivered", "completed"] },
];

const NEEDS_RIDER: OrderStatus[] = ["requested", "pickup_scheduled", "ready", "delivery_scheduled"];

function isLate(o: BoardOrder, now: number): boolean {
  return !!o.eta_ready_at && new Date(o.eta_ready_at).getTime() < now && statusIndex(o.status) < statusIndex("delivered");
}
function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(s);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-white p-4">
      <div className={`font-display text-3xl font-black ${tone ?? "text-navy"}`}>{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-muted">{label}</div>
    </div>
  );
}

export function OrdersBoard({ orders, couriers, laundries, zones }: { orders: BoardOrder[]; couriers: Opt[]; laundries: Opt[]; zones: Opt[] }) {
  const router = useRouter();
  const [now, setNow] = useState(0);
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");
  const [laundry, setLaundry] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [onlyLate, setOnlyLate] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [router]);

  const lateOf = (o: BoardOrder) => now > 0 && isLate(o, now);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (zone && o.zone_name !== zone) return false;
      if (laundry && o.laundry_id !== laundry) return false;
      if (onlyUnassigned && o.courier_id) return false;
      if (onlyLate && !lateOf(o)) return false;
      if (needle) {
        const hay = `${o.customer_name ?? ""} ${o.id} ${o.customer_phone ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, q, zone, laundry, onlyUnassigned, onlyLate, now]);

  const kpis = useMemo(() => {
    const active = orders.filter((o) => o.status !== "completed" && o.status !== "delivered");
    const toAssign = active.filter((o) => !o.courier_id && NEEDS_RIDER.includes(o.status)).length;
    const late = now > 0 ? orders.filter((o) => isLate(o, now)).length : 0;
    const done = orders.filter((o) => o.status === "delivered" || o.status === "completed").length;
    return { active: active.length, toAssign, late, done };
  }, [orders, now]);

  // Carico attivo per corriere (fermate non ancora consegnate).
  const courierLoad = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) {
      if (o.courier_id && o.status !== "delivered" && o.status !== "completed") {
        m.set(o.courier_id, (m.get(o.courier_id) ?? 0) + 1);
      }
    }
    return m;
  }, [orders]);
  const maxLoad = Math.max(1, ...couriers.map((c) => courierLoad.get(c.id) ?? 0));

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const inputCls = "h-10 rounded-[12px] border border-line bg-white px-3 text-sm font-medium text-navy outline-none focus:border-blue";

  return (
    <div className="pb-20">
      {/* Alert ritardi */}
      {kpis.late > 0 && (
        <button
          onClick={() => setOnlyLate((v) => !v)}
          className="mb-4 flex w-full items-center gap-2 rounded-[14px] border border-[#C0392B]/30 bg-[#C0392B]/8 px-4 py-3 text-left"
        >
          <span className="text-lg">⚠️</span>
          <span className="font-display text-sm font-extrabold text-[#C0392B]">
            {kpis.late} {kpis.late === 1 ? "ordine è" : "ordini sono"} in ritardo sull&apos;ETA
          </span>
          <span className="ml-auto font-display text-xs font-bold text-[#C0392B] underline">{onlyLate ? "Mostra tutti" : "Mostra solo questi"}</span>
        </button>
      )}

      {/* KPI */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Ordini attivi" value={kpis.active} />
        <Kpi label="Da assegnare" value={kpis.toAssign} tone={kpis.toAssign ? "text-blue" : "text-navy"} />
        <Kpi label="In ritardo" value={kpis.late} tone={kpis.late ? "text-[#C0392B]" : "text-navy"} />
        <Kpi label="Consegnati" value={kpis.done} tone="text-[#1F8A5B]" />
      </div>

      {/* Carico rider + auto-assegnazione bilanciata */}
      {couriers.length > 0 && (
        <div className="mb-5 rounded-[18px] border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-display text-sm font-extrabold text-navy">Carico rider</div>
              <div className="text-xs font-medium text-muted">Fermate attive per corriere. L&apos;auto-assegna bilancia i {kpis.toAssign} ordini da assegnare.</div>
            </div>
            <form action={autoAssignCouriers}>
              <button
                type="submit"
                disabled={kpis.toAssign === 0}
                className="h-10 rounded-[12px] bg-grad px-4 font-display text-sm font-extrabold text-white disabled:opacity-40"
              >
                ⚖️ Auto-assegna ({kpis.toAssign})
              </button>
            </form>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {couriers.map((c) => {
              const n = courierLoad.get(c.id) ?? 0;
              return (
                <div key={c.id} className="flex items-center gap-2.5">
                  <span className="w-24 flex-none truncate font-display text-xs font-bold text-navy">{c.name}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy/8">
                    <span className="block h-full rounded-full bg-gradient-to-r from-blue to-cyan" style={{ width: `${(n / maxLoad) * 100}%` }} />
                  </span>
                  <span className="w-6 flex-none text-right font-display text-xs font-black text-navy">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtri */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <input placeholder="Cerca cliente / telefono / #id" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} min-w-56 flex-1`} />
        <select value={zone} onChange={(e) => setZone(e.target.value)} className={inputCls}>
          <option value="">Tutte le zone</option>
          {zones.map((z) => (
            <option key={z.id} value={z.name}>{z.name}</option>
          ))}
        </select>
        <select value={laundry} onChange={(e) => setLaundry(e.target.value)} className={inputCls}>
          <option value="">Tutte le lavanderie</option>
          {laundries.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-[12px] border border-line bg-white px-3 text-sm font-semibold text-navy">
          <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} className="accent-[#2b7fd4]" />
          Solo da assegnare
        </label>
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-[12px] border border-line bg-white px-3 text-sm font-semibold text-navy">
          <input type="checkbox" checked={onlyLate} onChange={(e) => setOnlyLate(e.target.checked)} className="accent-[#C0392B]" />
          Solo in ritardo
        </label>
      </div>

      {/* Board */}
      <div className="grid gap-4 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = filtered
            .filter((o) => col.statuses.includes(o.status))
            .sort((a, b) => Number(lateOf(b)) - Number(lateOf(a)));
          return (
            <div key={col.key} className="rounded-[20px] bg-white/60 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="font-display text-sm font-extrabold text-navy">{col.label}</span>
                <span className="rounded-full bg-navy/10 px-2 py-0.5 font-display text-xs font-bold text-navy">{items.length}</span>
              </div>
              <div className="space-y-2.5">
                {items.map((o) => (
                  <BoardCard key={o.id} o={o} couriers={couriers} late={lateOf(o)} selected={selected.has(o.id)} onToggle={() => toggle(o.id)} />
                ))}
                {items.length === 0 && <div className="px-1 py-4 text-xs font-medium text-muted">Vuoto</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra assegnazione massiva */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 backdrop-blur">
          <form action={bulkAssignCourier} className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3">
            <input type="hidden" name="order_ids" value={[...selected].join(",")} />
            <span className="font-display text-sm font-extrabold text-navy">{selected.size} selezionati</span>
            <select name="courier_id" required className={`${inputCls} ml-auto`} defaultValue="">
              <option value="" disabled>Assegna rider…</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-[12px] bg-grad px-5 font-display text-sm font-extrabold text-white">
              Assegna a {selected.size}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="font-display text-sm font-bold text-muted hover:text-navy">
              Deseleziona
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function BoardCard({ o, couriers, late, selected, onToggle }: { o: BoardOrder; couriers: Opt[]; late: boolean; selected: boolean; onToggle: () => void }) {
  const needsRider = NEEDS_RIDER.includes(o.status) && !o.courier_id;
  const next = nextStatus(o.status);
  const slotAt = o.status === "ready" || o.status === "delivery_scheduled" || o.status === "out_for_delivery" ? o.delivery_at : o.pickup_at;

  return (
    <div className={`rounded-[16px] border bg-white p-3.5 shadow-[var(--shadow-sm)] ${selected ? "border-blue ring-2 ring-blue/20" : late ? "border-[#C0392B]/40" : "border-line"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={selected} onChange={onToggle} className="accent-[#2b7fd4]" />
          <Link href={`/admin/ordini/${o.id}`} className="font-display text-sm font-extrabold text-navy hover:underline">
            {o.customer_name ?? "Cliente"}
          </Link>
        </div>
        <span className="font-mono text-[10px] font-bold text-muted">#{o.id.slice(0, 6)}</span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={o.status} />
        {late && <span className="rounded-full bg-[#C0392B]/12 px-2 py-0.5 font-display text-[10px] font-extrabold uppercase text-[#C0392B]">In ritardo</span>}
        {needsRider && <span className="rounded-full bg-blue/15 px-2 py-0.5 font-display text-[10px] font-extrabold uppercase text-blue">Da assegnare</span>}
      </div>

      <div className="mt-2 space-y-0.5 text-xs font-medium text-muted">
        <div>{o.zone_name ?? "—"} · {o.bags} {o.bags === 1 ? "busta" : "buste"}{o.laundry_name ? ` · ${o.laundry_name}` : ""}</div>
        {slotAt && <div>Slot: {fmtDateTime(slotAt)}</div>}
        {o.eta_ready_at && <div>Pronto: {fmtDateTime(o.eta_ready_at)}</div>}
        {o.courier_name ? <div>Rider: <span className="font-bold text-navy">{o.courier_name}</span></div> : null}
        {o.customer_phone && <a href={`tel:${o.customer_phone}`} className="font-bold text-blue hover:underline">📞 {o.customer_phone}</a>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {couriers.length > 0 && (
          <form action={assignCourier}>
            <input type="hidden" name="order_id" value={o.id} />
            <select
              name="courier_id"
              defaultValue={o.courier_id ?? ""}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="h-8 rounded-[10px] border border-line bg-ice px-2 text-xs font-semibold text-navy outline-none focus:border-blue"
            >
              <option value="">Rider…</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </form>
        )}
        {next && (
          <form action={advanceStatus}>
            <input type="hidden" name="order_id" value={o.id} />
            <input type="hidden" name="status" value={next} />
            <button type="submit" className="h-8 rounded-[10px] bg-grad px-3 font-display text-xs font-extrabold text-white">
              → {ORDER_STATUS_LABEL[next]}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
