"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { assignCourier, advanceStatus } from "@/lib/actions/orders";
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
  const [now, setNow] = useState(() => 0);
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");
  const [laundry, setLaundry] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  // now è impostato solo lato client per evitare mismatch di idratazione
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Realtime: ad ogni cambio ordini, ricarica i dati server
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (zone && o.zone_name !== zone) return false;
      if (laundry && o.laundry_id !== laundry) return false;
      if (onlyUnassigned && o.courier_id) return false;
      if (needle) {
        const hay = `${o.customer_name ?? ""} ${o.id} ${o.customer_phone ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [orders, q, zone, laundry, onlyUnassigned]);

  const kpis = useMemo(() => {
    const active = orders.filter((o) => o.status !== "completed" && o.status !== "delivered");
    const toAssign = active.filter((o) => !o.courier_id && NEEDS_RIDER.includes(o.status)).length;
    const late = now > 0 ? orders.filter((o) => isLate(o, now)).length : 0;
    const doneToday = orders.filter((o) => (o.status === "delivered" || o.status === "completed")).length;
    return { active: active.length, toAssign, late, done: doneToday };
  }, [orders, now]);

  const inputCls = "h-10 rounded-[12px] border border-line bg-white px-3 text-sm font-medium text-navy outline-none focus:border-blue";

  return (
    <div>
      {/* KPI */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Ordini attivi" value={kpis.active} />
        <Kpi label="Da assegnare" value={kpis.toAssign} tone={kpis.toAssign ? "text-blue" : "text-navy"} />
        <Kpi label="In ritardo" value={kpis.late} tone={kpis.late ? "text-[#C0392B]" : "text-navy"} />
        <Kpi label="Consegnati" value={kpis.done} tone="text-[#1F8A5B]" />
      </div>

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
      </div>

      {/* Board */}
      <div className="grid gap-4 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = filtered.filter((o) => col.statuses.includes(o.status));
          return (
            <div key={col.key} className="rounded-[20px] bg-white/60 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="font-display text-sm font-extrabold text-navy">{col.label}</span>
                <span className="rounded-full bg-navy/10 px-2 py-0.5 font-display text-xs font-bold text-navy">{items.length}</span>
              </div>
              <div className="space-y-2.5">
                {items.map((o) => (
                  <BoardCard key={o.id} o={o} couriers={couriers} late={now > 0 && isLate(o, now)} />
                ))}
                {items.length === 0 && <div className="px-1 py-4 text-xs font-medium text-muted">Vuoto</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({ o, couriers, late }: { o: BoardOrder; couriers: Opt[]; late: boolean }) {
  const needsRider = NEEDS_RIDER.includes(o.status) && !o.courier_id;
  const next = nextStatus(o.status);
  const slotAt = o.status === "ready" || o.status === "delivery_scheduled" || o.status === "out_for_delivery" ? o.delivery_at : o.pickup_at;

  return (
    <div className={`rounded-[16px] border bg-white p-3.5 shadow-[var(--shadow-sm)] ${late ? "border-[#C0392B]/40" : "border-line"}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/admin/ordini/${o.id}`} className="font-display text-sm font-extrabold text-navy hover:underline">
          {o.customer_name ?? "Cliente"}
        </Link>
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

      {/* Azioni rapide */}
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
