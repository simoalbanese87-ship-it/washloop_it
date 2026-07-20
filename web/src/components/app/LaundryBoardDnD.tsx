"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { advanceStatus, setPartnerStatus } from "@/lib/actions/partner";
import type { OrderStatus } from "@/lib/orders";

export type PartnerOrder = {
  order_id: string;
  client_code: string | null;
  bags: number;
  service: string | null;
  fragrance: string | null;
  status: OrderStatus;
  eta_ready_at: string | null;
};

const COLUMNS: { key: string; title: string; status: OrderStatus }[] = [
  { key: "arrivo", title: "In arrivo", status: "picked_up" },
  { key: "arrivato", title: "Arrivato", status: "at_laundry" },
  { key: "lavoro", title: "In lavorazione", status: "washing" },
  { key: "pronti", title: "Pronti", status: "ready" },
];

const NEXT_CTA: Partial<Record<OrderStatus, string>> = {
  picked_up: "Segna arrivato",
  at_laundry: "Avvia lavaggio",
  washing: "Segna pronto",
};

function fmtEta(iso: string | null): string | null {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return null; }
}

export function LaundryBoardDnD({ orders }: { orders: PartnerOrder[] }) {
  const router = useRouter();
  const [items, setItems] = useState(orders);
  const [, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  // Riallinea allo stato server dopo un refresh (post azione).
  useEffect(() => { setItems(orders); }, [orders]);

  function move(id: string, status: OrderStatus) {
    setItems((prev) => prev.map((o) => (o.order_id === id ? { ...o, status } : o)));
    start(async () => {
      try { await setPartnerStatus(id, status); } finally { router.refresh(); }
    });
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => {
        const colItems = items.filter((o) => o.status === col.status);
        const isOver = overKey === col.key;
        return (
          <section
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOverKey(col.key); }}
            onDragLeave={() => setOverKey((k) => (k === col.key ? null : k))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragId;
              setOverKey(null); setDragId(null);
              if (id) move(id, col.status);
            }}
          >
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold text-navy">
              {col.title}
              <span className="rounded-full bg-navy px-2 py-0.5 font-display text-[11px] font-bold text-cyan">{colItems.length}</span>
            </h2>
            <div className={`min-h-[120px] space-y-3 rounded-[18px] p-1 transition-colors ${isOver ? "bg-blue/[0.06] outline-2 outline-dashed outline-blue/40" : ""}`}>
              {colItems.length > 0 ? (
                colItems.map((o) => {
                  const cta = NEXT_CTA[o.status];
                  const eta = fmtEta(o.eta_ready_at);
                  return (
                    <div
                      key={o.order_id}
                      draggable
                      onDragStart={(e) => { setDragId(o.order_id); e.dataTransfer.setData("text/plain", o.order_id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragId(null); setOverKey(null); }}
                      className={`cursor-grab active:cursor-grabbing ${dragId === o.order_id ? "opacity-50" : ""}`}
                    >
                      <Card className="!p-4">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/laundry/${o.order_id}`} className="font-display text-base font-black tracking-tight text-navy hover:text-blue">
                            {o.client_code ?? "—"}
                          </Link>
                          <span className="rounded-full bg-ice px-2.5 py-1 font-display text-[10px] font-extrabold uppercase tracking-wider text-blue">
                            {o.bags} {o.bags === 1 ? "sacco" : "sacchi"}
                          </span>
                        </div>
                        <dl className="mt-2.5 space-y-1 text-sm font-medium text-muted">
                          {o.service && <div>{o.service}</div>}
                          {o.fragrance && <div>Profumo: {o.fragrance}</div>}
                          {eta && <div className="text-navy/70">Pronto entro: {eta}</div>}
                        </dl>
                        <div className="mt-3 flex items-center gap-2">
                          <Link href={`/laundry/${o.order_id}`} className="font-display text-sm font-bold text-navy/55 hover:text-navy">Dettaglio</Link>
                          {cta && (
                            <form action={advanceStatus} className="ml-auto">
                              <input type="hidden" name="order_id" value={o.order_id} />
                              <Button type="submit" size="md" className="!min-h-[40px] !px-4 !text-sm">{cta}</Button>
                            </form>
                          )}
                        </div>
                      </Card>
                    </div>
                  );
                })
              ) : (
                <div className="grid min-h-[100px] place-items-center rounded-[14px] border border-dashed border-line text-xs font-medium text-muted">
                  Trascina qui
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
