"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/app/StatusBadge";
import { type OrderStatus } from "@/lib/orders";
import { fmtDate } from "@/lib/format";

export type CustOrder = {
  id: string;
  status: OrderStatus;
  created_at: string;
  bags: number;
  laundry_name: string | null;
  eta_ready_at: string | null;
};

type Tab = "attivi" | "storico";

const DONE: OrderStatus[] = ["delivered", "completed", "cancelled"];

const BagIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 7h12l1 13H5z" /><path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);
const ChevIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export function CustomerOrders({ rows }: { rows: CustOrder[] }) {
  const [tab, setTab] = useState<Tab>("attivi");

  const active = useMemo(() => rows.filter((r) => !DONE.includes(r.status)), [rows]);
  const past = useMemo(() => rows.filter((r) => DONE.includes(r.status)), [rows]);
  const list = tab === "attivi" ? active : past;

  return (
    <div>
      {/* Segmented control */}
      <div className="flex rounded-full bg-navy/[0.07] p-1">
        <SegBtn active={tab === "attivi"} onClick={() => setTab("attivi")} label={`Attivi (${active.length})`} />
        <SegBtn active={tab === "storico"} onClick={() => setTab("storico")} label={`Storico (${past.length})`} />
      </div>

      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <div className="rounded-[18px] border border-line bg-white px-4 py-8 text-center text-sm font-medium text-muted">
            {tab === "attivi" ? "Nessun ordine in corso. Prenota un ritiro col tasto ➕." : "Nessun ordine concluso."}
          </div>
        ) : (
          list.map((o) => (
            <Link
              key={o.id}
              href={`/app/ordini/${o.id}`}
              className="flex items-center gap-3 rounded-[18px] border border-line bg-white px-4 py-3.5 transition-colors active:bg-ice"
            >
              <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-ice text-blue">
                <BagIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-sm font-bold text-navy">Ordine #{o.id.slice(0, 8)}</span>
                <span className="block text-xs font-medium text-muted">
                  {o.bags} {o.bags === 1 ? "sacco" : "sacchi"} · {fmtDate(o.created_at)}
                </span>
              </span>
              <span className="flex flex-none flex-col items-end gap-1.5">
                <StatusBadge status={o.status} />
                <span className="text-navy/30"><ChevIcon /></span>
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function SegBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full py-2 font-display text-[13.5px] font-extrabold transition-colors ${
        active ? "bg-white text-navy shadow-[0_1px_0_rgba(27,45,94,0.04),0_10px_24px_-18px_rgba(27,45,94,0.5)]" : "text-muted"
      }`}
    >
      {label}
    </button>
  );
}
