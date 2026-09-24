/** Tile KPI per la dashboard admin. Numero grande + etichetta + sottotitolo. */
export function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-white p-4">
      <div className="font-display text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className={`mt-1 font-display text-[26px] font-black tracking-[-0.02em] ${tone ?? "text-navy"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs font-medium text-muted">{sub}</div>}
    </div>
  );
}
