"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";
import { fmtDate } from "@/lib/format";

export type ArchiveRow = {
  id: string;
  status: OrderStatus;
  created_at: string;
  bags: number;
  customer_name: string | null;
  zone_name: string | null;
  laundry_name: string | null;
  courier_name: string | null;
};

const CLOSED: OrderStatus[] = ["delivered", "completed", "cancelled"];
const inputCls = "h-10 rounded-[12px] border border-line bg-white px-3 text-sm font-medium text-navy outline-none focus:border-blue";

export function ArchiveList({ rows }: { rows: ArchiveRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | OrderStatus>("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (needle && !`${r.customer_name ?? ""} ${r.id}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, status]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2.5">
        <input placeholder="Cerca cliente / #id" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} min-w-56 flex-1`} />
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")} className={inputCls}>
          <option value="">Tutti gli stati chiusi</option>
          {CLOSED.map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[20px] border border-line bg-white p-6 text-sm font-medium text-muted">Nessun ordine in archivio.</div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-line bg-white">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 border-b border-line bg-ice px-5 py-3 font-display text-xs font-extrabold uppercase tracking-wide text-blue sm:grid">
            <div>Cliente</div><div>Zona / Lavanderia</div><div>Rider</div><div>Data</div><div>Stato</div>
          </div>
          {filtered.map((r) => (
            <Link key={r.id} href={`/admin/ordini/${r.id}`} className="grid grid-cols-2 gap-3 border-b border-line px-5 py-3.5 transition-colors last:border-0 hover:bg-ice sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] sm:items-center">
              <div>
                <div className="font-display text-sm font-bold text-navy">{r.customer_name ?? "Cliente"}</div>
                <div className="font-mono text-[11px] text-muted">#{r.id.slice(0, 8)} · {r.bags} {r.bags === 1 ? "busta" : "buste"}</div>
              </div>
              <div className="text-sm font-medium text-muted">{r.zone_name ?? "—"}{r.laundry_name ? ` · ${r.laundry_name}` : ""}</div>
              <div className="text-sm font-medium text-muted">{r.courier_name ?? "—"}</div>
              <div className="text-sm font-medium text-muted">{fmtDate(r.created_at)}</div>
              <div><StatusBadge status={r.status} /></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
