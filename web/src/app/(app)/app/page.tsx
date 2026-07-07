import Link from "next/link";
import { StatusBadge } from "@/components/app/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";
import { fmtDate, fmtFull, WEEKDAY_IT } from "@/lib/format";
import { cancelRecurring, confirmRecurring, rejectRecurring } from "@/lib/actions/orders";

type OrderRow = { id: string; status: OrderStatus; created_at: string; bags: number; eta_ready_at: string | null };
type SubRow = { status: string; current_period_end: string | null; plans: { name: string; bags_per_week: number } | null };
type RecRow = {
  id: string; weekday: number; hhmm: string; bags: number; active: boolean; needs_confirmation: boolean;
  delivery_hhmm: string | null;
  pending_weekday: number | null; pending_hhmm: string | null; pending_bags: number | null; pending_delivery_hhmm: string | null;
};

const ACTIVE_ORDER: OrderStatus[] = ["pickup_scheduled", "picked_up", "at_laundry", "washing", "ready", "delivery_scheduled", "out_for_delivery"];

export default async function Home() {
  const supabase = await createClient();
  const [{ data: sub }, { data: orders }, { data: recs }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, current_period_end, plans(name, bags_per_week)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SubRow>(),
    supabase
      .from("orders")
      .select("id, status, created_at, bags, eta_ready_at")
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<OrderRow[]>(),
    supabase
      .from("recurring_pickups")
      .select("id, weekday, hhmm, bags, active, needs_confirmation, delivery_hhmm, pending_weekday, pending_hhmm, pending_bags, pending_delivery_hhmm")
      // Attive + quelle proposte dall'admin ancora da confermare (anche se non ancora attive).
      .or("active.eq.true,needs_confirmation.eq.true")
      .order("created_at", { ascending: false })
      .returns<RecRow[]>(),
  ]);

  const recurring = recs ?? [];

  const active = sub?.status === "active" || sub?.status === "trialing";
  const ongoing = (orders ?? []).find((o) => ACTIVE_ORDER.includes(o.status));

  return (
    <div className="space-y-6">
      {/* Status card */}
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#26417a] to-[#16264f] p-6 text-white shadow-[0_18px_44px_-24px_rgba(27,45,94,0.7)]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-cyan/20 blur-2xl" />
        {ongoing ? (
          <>
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Il tuo bucato</div>
            <div className="mt-2 font-display text-[26px] font-black leading-tight">{ORDER_STATUS_LABEL[ongoing.status]}</div>
            <p className="mt-1.5 text-sm font-medium text-white/70">
              {ongoing.eta_ready_at ? `Pronto entro ${fmtFull(ongoing.eta_ready_at)}` : `${ongoing.bags} ${ongoing.bags === 1 ? "sacco" : "sacchi"} in lavorazione`}
            </p>
            <Link href={`/app/ordini/${ongoing.id}`} className="mt-4 inline-flex rounded-full bg-white/15 px-4 py-2 font-display text-sm font-extrabold text-white backdrop-blur transition-colors hover:bg-white/25">
              Segui l&apos;ordine →
            </Link>
          </>
        ) : active ? (
          <>
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Tutto pronto</div>
            <div className="mt-2 font-display text-[26px] font-black leading-tight">Prenota il prossimo ritiro</div>
            <p className="mt-1.5 text-sm font-medium text-white/70">Scegli giorno e fascia: passiamo noi sotto casa.</p>
            <Link href="/app/prenota" className="mt-4 inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
              Prenota ritiro →
            </Link>
          </>
        ) : (
          <>
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Inizia qui</div>
            <div className="mt-2 font-display text-[26px] font-black leading-tight">Attiva un abbonamento</div>
            <p className="mt-1.5 text-sm font-medium text-white/70">Scegli il piano e inizia a prenotare i ritiri.</p>
            <Link href="/app/abbonamento" className="mt-4 inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
              Scegli il piano →
            </Link>
          </>
        )}
      </section>

      {/* Ritiri ricorrenti attivi */}
      {recurring.length > 0 && (
        <section className="rounded-[22px] border border-line bg-white p-5">
          <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.16em] text-blue">Ricorrente</div>
          <div className="mt-2 space-y-3">
            {recurring.map((r) => {
              const deliv = (d: string | null) => (d ? ` · consegna ${d}` : "");
              const isEdit = r.needs_confirmation && r.pending_hhmm != null; // modifica a ricorrenza esistente
              const propWeekday = r.pending_weekday ?? r.weekday;
              const propHhmm = r.pending_hhmm ?? r.hhmm;
              const propBags = r.pending_bags ?? r.bags;
              const propDeliv = isEdit ? r.pending_delivery_hhmm : r.delivery_hhmm;
              const note = !r.active
                ? "non ancora attivo — da confermare"
                : active ? "si ripete in automatico" : "in pausa fino al rinnovo dell'abbonamento";
              return (
                <div key={r.id} className={`rounded-[16px] ${r.needs_confirmation ? "border border-[#C9881F]/35 bg-[#C9881F]/8 p-3" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display text-base font-black text-navy">Ogni {WEEKDAY_IT[r.weekday]} · {r.hhmm}</div>
                      <div className="text-xs font-medium text-muted">
                        {r.bags} {r.bags === 1 ? "sacco" : "sacchi"}{deliv(r.delivery_hhmm)} · {note}
                      </div>
                    </div>
                    {r.active && (
                      <form action={cancelRecurring}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="flex-none font-display text-xs font-bold text-[#C0392B] hover:underline">Disattiva</button>
                      </form>
                    )}
                  </div>
                  {r.needs_confirmation && (
                    <div className="mt-2 border-t border-[#C9881F]/25 pt-2">
                      <div className="text-xs font-semibold text-[#C9881F]">
                        {isEdit ? "Nuovo orario proposto da WashLoop:" : "Nuovo ritiro proposto da WashLoop:"}{" "}
                        <span className="font-extrabold">Ogni {WEEKDAY_IT[propWeekday]} · {propHhmm} · {propBags} {propBags === 1 ? "sacco" : "sacchi"}{deliv(propDeliv)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <form action={confirmRecurring}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="rounded-full bg-[#C9881F] px-3.5 py-1.5 font-display text-xs font-extrabold text-white">Conferma</button>
                        </form>
                        <form action={rejectRecurring}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="rounded-full border border-[#C9881F]/40 px-3.5 py-1.5 font-display text-xs font-bold text-[#C9881F]">Rifiuta</button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Azioni rapide */}
      <section className="grid grid-cols-2 gap-3">
        <QuickAction href="/app/prenota" title="Prenota" sub="Nuovo ritiro" />
        <QuickAction href="/app/ordini" title="Ordini" sub="Storico e tracking" />
        <QuickAction href="/app/indirizzi" title="Indirizzi" sub="Dove ritiriamo" />
        <QuickAction href="/app/abbonamento" title="Abbonamento" sub={active ? "Gestisci piano" : "Attiva"} />
      </section>

      {/* Guida installa app + notifiche (sempre visibile, per chi non è pratico) */}
      <Link href="/app/installa" className="flex items-center gap-3 rounded-[18px] border border-line bg-white px-4 py-3.5 transition-colors active:bg-ice">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-gradient-to-br from-blue to-cyan text-lg text-white">📲</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-extrabold text-navy">Installa l&apos;app e attiva le notifiche</span>
          <span className="block text-xs font-medium text-muted">Guida rapida in 2 passi</span>
        </span>
        <span className="flex-none font-display text-lg font-black text-navy/30">→</span>
      </Link>

      {/* Uso del mese */}
      {active && sub?.plans && (
        <section className="rounded-[22px] border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.16em] text-blue">Il tuo piano</div>
              <div className="mt-1 font-display text-xl font-black text-navy">{sub.plans.name}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-black text-navy">{sub.plans.bags_per_week}</div>
              <div className="text-[11px] font-bold text-muted">{sub.plans.bags_per_week === 1 ? "sacco/sett" : "sacchi/sett"}</div>
            </div>
          </div>
          {sub.current_period_end && (
            <p className="mt-3 border-t border-line pt-3 text-xs font-semibold text-muted">Rinnovo il {fmtDate(sub.current_period_end)}</p>
          )}
        </section>
      )}

      {/* Ordini recenti */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold text-navy">Ordini recenti</h2>
          {orders && orders.length > 0 && (
            <Link href="/app/ordini" className="font-display text-sm font-bold text-blue">Tutti</Link>
          )}
        </div>
        {orders && orders.length > 0 ? (
          <div className="space-y-2.5">
            {orders.map((o) => (
              <Link key={o.id} href={`/app/ordini/${o.id}`} className="flex items-center justify-between rounded-[18px] border border-line bg-white px-4 py-3.5 transition-colors active:bg-ice">
                <div>
                  <div className="font-display text-sm font-bold text-navy">Ordine #{o.id.slice(0, 8)}</div>
                  <div className="text-xs font-medium text-muted">{fmtDate(o.created_at)} · {o.bags} {o.bags === 1 ? "sacco" : "sacchi"}</div>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-line bg-white px-4 py-6 text-center text-sm font-medium text-muted">
            Nessun ordine ancora. Prenota il tuo primo ritiro col tasto ➕.
          </div>
        )}
      </section>
    </div>
  );
}

function QuickAction({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link href={href} className="rounded-[18px] border border-line bg-white p-4 transition-colors active:bg-ice">
      <div className="font-display text-base font-extrabold text-navy">{title}</div>
      <div className="mt-0.5 text-xs font-medium text-muted">{sub}</div>
    </Link>
  );
}
