"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/app/StatusBadge";
import { statusIndex, type OrderStatus } from "@/lib/orders";
import { fmtDate } from "@/lib/format";

export type CustOrder = {
  id: string;
  status: OrderStatus;
  created_at: string;
  bags: number;
  laundry_name: string | null;
  eta_ready_at: string | null;
};

type Tab = "all" | "active" | "done";

export function CustomerOrders({ rows }: { rows: CustOrder[] }) {
  const [tab, setTab] = useState<Tab>("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab === "active") return r.status !== "delivered" && r.status !== "completed" && r.status !== "cancelled";
      if (tab === "done") return r.status === "delivered" || r.status === "completed";
      return true;
    });
  }, [rows, tab]);

  const tabs: { k: Tab; l: string }[] = [
    { k: "all", l: "Tutti" },
    { k: "active", l: "In corso" },
    { k: "done", l: "Conclusi" },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`rounded-full px-4 py-1.5 font-display text-sm font-bold transition-colors ${tab === t.k ? "bg-navy text-white" : "bg-white text-navy/60 hover:text-navy"}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[20px] border border-line bg-white p-6 text-sm font-medium text-muted">Nessun ordine.</div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-line bg-white">
          {filtered.map((o) => (
            <Link key={o.id} href={`/app/ordini/${o.id}`} className="flex items-center justify-between border-b border-line px-6 py-4 transition-colors last:border-0 hover:bg-ice">
              <div>
                <div className="font-display text-sm font-bold text-navy">Ordine #{o.id.slice(0, 8)}</div>
                <div className="text-xs font-medium text-muted">
                  {fmtDate(o.created_at)} · {o.bags} {o.bags === 1 ? "busta" : "buste"}{o.laundry_name ? ` · ${o.laundry_name}` : ""}
                  {o.eta_ready_at && statusIndex(o.status) < statusIndex("delivered") ? " · pronto previsto" : ""}
                </div>
              </div>
              <StatusBadge status={o.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
