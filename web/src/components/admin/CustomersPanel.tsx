"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DashboardCustomer } from "@/lib/admin-metrics";
import { DeleteUserButton } from "./DeleteUserButton";

/** Elenco clienti (abbonati attivi) con ricerca e elimina. */

const STATUS_LABEL: Record<string, string> = { active: "Attivo", trialing: "In prova" };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "2-digit" }); } catch { return "—"; }
}

export function CustomersPanel({ customers }: { customers: DashboardCustomer[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(s) || (c.phone ?? "").includes(s) || c.planName.toLowerCase().includes(s));
  }, [customers, q]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca cliente, telefono, piano…"
          className="h-9 flex-1 rounded-[12px] border border-line bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-blue"
        />
        <span className="font-display text-xs font-bold text-muted">{filtered.length}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-[12px] border border-line bg-ice px-4 py-6 text-center text-sm font-medium text-muted">Nessun cliente.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-[14px] border border-line bg-white px-3 py-2.5">
              <span className="h-9 w-1 flex-none rounded-full bg-[#1F8A5B]" aria-hidden />
              <Link href={c.href} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-extrabold text-navy">{c.name}</span>
                  <span className="rounded-full bg-[#1F8A5B]/12 px-2 py-0.5 font-display text-[10px] font-bold text-[#1F8A5B]">{STATUS_LABEL[c.status] ?? c.status}</span>
                  <span className="rounded-full bg-blue/10 px-2 py-0.5 font-display text-[10px] font-bold text-blue">{c.planName}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs font-medium text-muted">
                  {c.phone && <span>{c.phone}</span>}
                  <span>Cliente dal {fmtDate(c.since)}</span>
                </div>
              </Link>
              <DeleteUserButton id={c.id} name={c.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
