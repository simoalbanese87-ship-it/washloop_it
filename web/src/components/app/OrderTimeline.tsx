"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ORDER_FLOW, ORDER_STATUS_LABEL, statusIndex, type OrderStatus } from "@/lib/orders";

/** Timeline di tracking con aggiornamento realtime via Supabase. */
export function OrderTimeline({ orderId, initialStatus }: { orderId: string; initialStatus: OrderStatus }) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const next = (payload.new as { status?: OrderStatus }).status;
          if (next) setStatus(next);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (status === "cancelled") {
    return <div className="rounded-[14px] bg-[#C0392B]/10 px-4 py-3 font-display text-sm font-bold text-[#C0392B]">Ordine annullato</div>;
  }

  const current = statusIndex(status);

  return (
    <ol className="relative ml-3 border-l-2 border-line">
      {ORDER_FLOW.map((s, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <li key={s} className="mb-5 ml-5 last:mb-0">
            <span
              className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ${
                done ? "bg-blue" : isCurrent ? "bg-cyan ring-4 ring-cyan/25" : "bg-line"
              }`}
            />
            <div className={`font-display text-sm ${isCurrent ? "font-black text-navy" : done ? "font-bold text-navy/70" : "font-semibold text-muted"}`}>
              {ORDER_STATUS_LABEL[s]}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
