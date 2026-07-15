"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DashboardLead } from "@/lib/admin-metrics";

/** Lead per stato & provenienza, con filtri. Provenienza distinta per
 *  colore + icona (no solo colore): Sito = blu (globo), Lista d'attesa =
 *  ambra (clessidra). Chip di stato con palette semantica. */

const STATUS_LABEL: Record<string, string> = {
  active: "Attivo", trialing: "In prova", past_due: "Pagamento sospeso",
  unpaid: "Non pagato", canceled: "Disdetto", paused: "In pausa",
  incomplete: "Da attivare", pending: "Nuovo lead", waitlist: "Lista d'attesa",
};
const statusTone = (s: string) =>
  s === "past_due" || s === "unpaid" ? "bg-[#C0392B]/12 text-[#C0392B]"
    : s === "canceled" || s === "paused" ? "bg-navy/10 text-navy"
    : "bg-[#C9881F]/15 text-[#C9881F]"; // pending/incomplete/waitlist

const SOURCE = {
  site: { label: "Sito", chip: "bg-[#2b7fd4]/12 text-[#2b7fd4]", bar: "bg-[#2b7fd4]" },
  funnel: { label: "Lista d'attesa", chip: "bg-[#C9881F]/15 text-[#C9881F]", bar: "bg-[#C9881F]" },
} as const;

const GlobeIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
  </svg>
);
const HourglassIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12M6 21h12M6 3c0 4 3 6 6 9c3-3 6-5 6-9M6 21c0-4 3-6 6-9" />
  </svg>
);

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "2-digit" }); } catch { return "—"; }
}

export function LeadsPanel({ leads, leadError }: { leads: DashboardLead[]; leadError: string | null }) {
  const [source, setSource] = useState<"all" | "site" | "funnel">("all");
  const [status, setStatus] = useState<string>("all");

  const statuses = useMemo(() => Array.from(new Set(leads.map((l) => l.status))), [leads]);

  const filtered = useMemo(
    () => leads.filter((l) => (source === "all" || l.source === source) && (status === "all" || l.status === status)),
    [leads, source, status],
  );

  const siteCount = leads.filter((l) => l.source === "site").length;
  const funnelCount = leads.filter((l) => l.source === "funnel").length;

  const seg = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 font-display text-xs font-extrabold transition-colors ${active ? "bg-navy text-white" : "bg-ice text-navy hover:bg-navy/10"}`;
  const selCls = "h-9 rounded-[12px] border border-line bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-blue";

  return (
    <div>
      {/* Filtri */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setSource("all")} className={seg(source === "all")}>Tutte ({leads.length})</button>
          <button onClick={() => setSource("site")} className={seg(source === "site")}>Sito ({siteCount})</button>
          <button onClick={() => setSource("funnel")} className={seg(source === "funnel")}>Lista d&apos;attesa ({funnelCount})</button>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selCls} ml-auto`} aria-label="Filtra per stato">
          <option value="all">Tutti gli stati</option>
          {statuses.map((s) => (<option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>))}
        </select>
      </div>

      {leadError && (
        <div className="mb-3 rounded-[12px] bg-[#C9881F]/10 px-3 py-2 text-xs font-semibold text-[#C9881F]">
          Lista d&apos;attesa non raggiungibile: {leadError}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-[12px] border border-line bg-ice px-4 py-6 text-center text-sm font-medium text-muted">Nessun lead con questi filtri.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => {
            const src = SOURCE[l.source];
            const Row = (
              <div className="flex items-center gap-3">
                <span className={`h-9 w-1 flex-none rounded-full ${src.bar}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-extrabold text-navy">{l.name}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[10px] font-bold ${src.chip}`}>
                      {l.source === "site" ? <GlobeIcon /> : <HourglassIcon />}{src.label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-display text-[10px] font-bold ${statusTone(l.status)}`}>{STATUS_LABEL[l.status] ?? l.status}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs font-medium text-muted">
                    {l.email && <span>{l.email}</span>}
                    {l.phone && <span>{l.phone}</span>}
                    <span>{fmtDate(l.date)}</span>
                  </div>
                </div>
                {l.href && <span className="flex-none font-display text-xs font-bold text-blue">Apri →</span>}
              </div>
            );
            return l.href ? (
              <Link key={l.key} href={l.href} className="block rounded-[14px] border border-line bg-white px-3 py-2.5 transition-colors hover:bg-ice">{Row}</Link>
            ) : (
              <div key={l.key} className="rounded-[14px] border border-line bg-white px-3 py-2.5">{Row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
