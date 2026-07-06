import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createServiceClient } from "@/lib/supabase/server";
import { impersonate, createDemoCustomer } from "@/lib/actions/impersonate";
import { createCustomer } from "@/lib/actions/admin-customer";
import { fmtDate } from "@/lib/format";

const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";
type Plan = { id: string; name: string };
type Prof = { id: string; full_name: string | null; phone: string | null; created_at: string };
type Sub = { user_id: string; status: string; current_period_end: string | null; created_at: string; plans: { name: string } | null };

type Row = {
  user_id: string;
  name: string;
  phone: string;
  planName: string | null;
  status: string;        // active | trialing | past_due | ... | pending
  current_period_end: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Attivo", trialing: "In prova", past_due: "Pagamento sospeso",
  unpaid: "Non pagato", canceled: "Disdetto", paused: "In pausa",
  incomplete: "Da attivare", pending: "Pending (lead)",
};
const tone = (s: string) =>
  s === "active" || s === "trialing" ? "bg-[#1F8A5B]/15 text-[#1F8A5B]"
    : s === "past_due" || s === "unpaid" ? "bg-[#C0392B]/12 text-[#C0392B]"
    : s === "pending" || s === "incomplete" ? "bg-[#C9881F]/15 text-[#C9881F]"
    : "bg-navy/10 text-navy";

export default async function AbbonatiPage({ searchParams }: { searchParams: Promise<{ ok?: string; warn?: string }> }) {
  const { ok, warn } = await searchParams;
  // Service client: la dashboard admin (layout già role=admin) elenca TUTTI i
  // profili clienti, anche senza subscription (lead/pending).
  const svc = createServiceClient();
  const [{ data: profiles }, { data: subsAll }, { data: plans }] = await Promise.all([
    svc.from("profiles").select("id, full_name, phone, created_at").eq("role", "customer").order("created_at", { ascending: false }).returns<Prof[]>(),
    svc.from("subscriptions").select("user_id, status, current_period_end, created_at, plans(name)").order("created_at", { ascending: false }).returns<Sub[]>(),
    svc.from("plans").select("id, name").eq("active", true).order("sort").returns<Plan[]>(),
  ]);

  // Subscription più recente per ciascun cliente.
  const latestSub = new Map<string, Sub>();
  for (const s of subsAll ?? []) if (!latestSub.has(s.user_id)) latestSub.set(s.user_id, s);

  const rows: Row[] = (profiles ?? []).map((p) => {
    const s = latestSub.get(p.id);
    return {
      user_id: p.id,
      name: p.full_name ?? "—",
      phone: p.phone ?? "",
      planName: s?.plans?.name ?? null,
      status: s?.status ?? "pending",
      current_period_end: s?.current_period_end ?? null,
      created_at: p.created_at,
    };
  });
  const active = rows.filter((r) => r.status === "active" || r.status === "trialing").length;
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <>
      <PageTitle kicker="Abbonati" title="Clienti & piani" sub={`${rows.length} clienti · ${active} attivi · ${pending} pending`} />

      {ok && (
        <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>
      )}
      {warn && (
        <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3 rounded-[16px] border border-line bg-ice px-4 py-3">
        <div className="text-sm font-medium text-muted">Simula l&apos;esperienza cliente: entra in un abbonato o crea un cliente demo già attivo.</div>
        <form action={createDemoCustomer}>
          <Button type="submit" size="md">Crea cliente demo e simula →</Button>
        </form>
      </div>

      {/* Crea cliente reale (anche prezzo custom sotto lo Small) */}
      <Card className="mb-6">
        <h2 className="font-display text-base font-extrabold text-navy">Crea cliente</h2>
        <p className="mt-1 text-xs font-medium text-muted">Crea un cliente con abbonamento attivo. Lascia vuoto il prezzo per usare quello del piano; inseriscilo per un prezzo concordato (es. sotto lo Small) — fatturazione manuale.</p>
        <form action={createCustomer} className="mt-4 grid gap-2 sm:grid-cols-[1.4fr_1.4fr_1fr_1fr_0.8fr_auto] sm:items-end">
          <label className="text-xs font-bold text-muted">Nome e cognome<input name="full_name" required className={input} /></label>
          <label className="text-xs font-bold text-muted">Email<input name="email" required type="email" className={input} /></label>
          <label className="text-xs font-bold text-muted">Telefono<input name="phone" className={input} /></label>
          <label className="text-xs font-bold text-muted">Piano
            <select name="plan_id" className={input} defaultValue="">
              <option value="">—</option>
              {(plans ?? []).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted">Prezzo €<input name="price_eur" type="number" step="0.01" min="0" placeholder="custom" className={input} /></label>
          <Button type="submit" size="md">Crea →</Button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm font-medium text-muted">Nessun cliente ancora.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-line bg-white">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-line bg-ice px-6 py-3 font-display text-xs font-extrabold uppercase tracking-wide text-blue">
            <div>Cliente</div>
            <div>Piano</div>
            <div>Stato</div>
            <div>Rinnovo</div>
            <div></div>
          </div>
          {rows.map((r) => (
            <div key={r.user_id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-line px-6 py-4 last:border-0">
              <div>
                <Link href={`/admin/abbonati/${r.user_id}`} className="font-display text-sm font-bold text-navy hover:text-blue hover:underline">
                  {r.name}
                </Link>
                <div className="text-xs font-medium text-muted">{r.phone}{r.phone ? " · " : ""}Iscritto il {fmtDate(r.created_at)}</div>
              </div>
              <div className="text-sm font-semibold text-navy">{r.planName ?? "—"}</div>
              <div>
                <span className={`inline-flex rounded-full px-2.5 py-1 font-display text-xs font-bold ${tone(r.status)}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
              </div>
              <div className="text-sm font-medium text-muted">
                {r.current_period_end ? fmtDate(r.current_period_end) : "—"}
              </div>
              <form action={impersonate}>
                <input type="hidden" name="user_id" value={r.user_id} />
                <button type="submit" className="rounded-full border border-line px-3 py-1.5 font-display text-xs font-extrabold text-blue transition-colors hover:bg-ice">
                  Accedi come →
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
