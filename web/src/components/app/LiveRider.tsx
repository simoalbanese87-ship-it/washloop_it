"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { riderLivePosition } from "@/lib/actions/orders";
import type { RiderLivePos } from "@/lib/orders";

/** Cliente: mostra il rider live sulla mappa SOLO quando è vicino e in fase attiva
 *  (la gating è lato server in riderLivePosition). Polling ogni 15s. */
const LiveRiderMapView = dynamic(() => import("./LiveRiderMapView"), {
  ssr: false,
  loading: () => <div className="grid h-[260px] place-items-center rounded-[16px] bg-ice text-sm font-medium text-muted">Carico la mappa…</div>,
});

export function LiveRider({ orderId }: { orderId: string }) {
  const [pos, setPos] = useState<RiderLivePos>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => { riderLivePosition(orderId).then((p) => { if (alive) setPos(p); }).catch(() => {}); };
    tick();
    const t = setInterval(tick, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [orderId]);

  if (!pos) {
    return (
      <div className="rounded-[16px] border border-line bg-white p-4 text-sm font-medium text-muted">
        Ti mostreremo il rider sulla mappa non appena sarà nella tua zona.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-[#1F8A5B]" />
        <span className="font-display text-sm font-extrabold text-navy">{pos.label}</span>
      </div>
      <LiveRiderMapView pos={pos} />
    </div>
  );
}
