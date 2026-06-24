import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { impersonate, createDemoCustomer } from "@/lib/actions/impersonate";
import { createCustomer } from "@/lib/actions/admin-customer";
import { fmtDate } from "@/lib/format";

const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";
type Plan = { id: string; name: string };

type Sub = {
  id: string;
  status: string;
  user_id: string;
  current_period_end: string | null;
  founder_pricing: boolean;
  profiles: { full_name: string | null; phone: string | null } | null;
  plans: { name: string } | null;
};

const tone = (s: string) =>
  s === "active" || s === "trialing" ? "bg-[#1F8A5B]/15 text-[#1F8A5B]" : s === "past_due" || s === "unpaid" ? "bg-[#C0392B]/12 text-[#C0392B]" : "bg-navy/10 text-navy";

export default async function AbbonatiPage() {
  const supabase = await createClient();
  const [{ data: subs }, { data: plans }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, status, user_id, current_period_end, founder_pricing, profiles(full_name, phone), plans(name)")
      .order("created_at", { ascending: false })
      .returns<Sub[]>(),
    supabase.from("plans").select("id, name").eq("active", true).order("sort").returns<Plan[]>(),
  ]);

  const rows = subs ?? [];
  const active = rows.filter((s) => s.status === "active" || s.status === "trialing").length;

  return (
    <>
      <PageTitle kicker="Abbonati" title="Clienti & piani" sub={`${rows.length} abbonamenti · ${active} attivi`} />

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
          <p className="text-sm font-medium text-muted">Nessun abbonamento ancora. Compaiono qui dopo il primo Checkout completato.</p>
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
          {rows.map((s) => (
            <div key={s.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-line px-6 py-4 last:border-0">
              <div>
                <Link href={`/admin/abbonati/${s.user_id}`} className="font-display text-sm font-bold text-navy hover:text-blue hover:underline">
                  {s.profiles?.full_name ?? "—"}
                </Link>
                <div className="text-xs font-medium text-muted">{s.profiles?.phone ?? ""}</div>
              </div>
              <div className="text-sm font-semibold text-navy">{s.plans?.name ?? "—"}</div>
              <div>
                <span className={`inline-flex rounded-full px-2.5 py-1 font-display text-xs font-bold ${tone(s.status)}`}>{s.status}</span>
              </div>
              <div className="text-sm font-medium text-muted">
                {s.current_period_end ? fmtDate(s.current_period_end) : "—"}
              </div>
              <form action={impersonate}>
                <input type="hidden" name="user_id" value={s.user_id} />
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
