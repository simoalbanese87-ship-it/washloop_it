import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { createZone, createLaundry, createSlot, updatePlanPrice } from "@/lib/actions/admin";

type Zone = { id: string; name: string };
type Laundry = { id: string; name: string; zones: { name: string } | null };
type Slot = { id: string; kind: string; starts_at: string; ends_at: string; zones: { name: string } | null };
type Plan = { id: string; name: string; price_month_cents: number; stripe_price_id: string | null };

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";

export default async function CatalogoPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: zones }, { data: laundries }, { data: slots }, { data: plans }] = await Promise.all([
    supabase.from("zones").select("id, name").order("name").returns<Zone[]>(),
    supabase.from("laundries").select("id, name, zones(name)").order("name").returns<Laundry[]>(),
    supabase.from("slots").select("id, kind, starts_at, ends_at, zones(name)").gte("starts_at", nowIso).order("starts_at").limit(30).returns<Slot[]>(),
    supabase.from("plans").select("id, name, price_month_cents, stripe_price_id").order("sort").returns<Plan[]>(),
  ]);

  return (
    <>
      <PageTitle kicker="Catalogo" title="Zone, slot e piani" sub="La configurazione operativa del servizio." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* PIANI → Stripe */}
        <Card className="lg:col-span-2">
          <h2 className="font-display text-base font-extrabold text-navy">Piani & Stripe</h2>
          <p className="mt-1 text-sm font-medium text-muted">Incolla lo Stripe Price ID di ogni piano per abilitare il Checkout.</p>
          <div className="mt-4 space-y-3">
            {(plans ?? []).map((p) => (
              <form key={p.id} action={updatePlanPrice} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="plan_id" value={p.id} />
                <div className="w-32">
                  <div className="font-display text-sm font-extrabold text-navy">{p.name}</div>
                  <div className="text-xs font-medium text-muted">€{(p.price_month_cents / 100).toLocaleString("it-IT")}/mese</div>
                </div>
                <input name="stripe_price_id" defaultValue={p.stripe_price_id ?? ""} placeholder="price_..." className={`${input} flex-1 min-w-48`} />
                <Button type="submit" size="md" variant="ghost-navy">
                  Salva
                </Button>
              </form>
            ))}
          </div>
        </Card>

        {/* ZONE */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Zone</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(zones ?? []).map((z) => (
              <span key={z.id} className="rounded-full border border-line bg-ice px-3 py-1 text-sm font-semibold text-navy">{z.name}</span>
            ))}
          </div>
          <form action={createZone} className="mt-4 flex gap-2">
            <input name="name" placeholder="Nuova zona" className={input} />
            <Button type="submit" size="md" variant="ghost-navy">+</Button>
          </form>
        </Card>

        {/* LAVANDERIE */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Lavanderie partner</h2>
          <div className="mt-3 space-y-1.5">
            {(laundries ?? []).map((l) => (
              <div key={l.id} className="text-sm font-semibold text-navy">{l.name} <span className="font-medium text-muted">{l.zones?.name && `· ${l.zones.name}`}</span></div>
            ))}
            {(!laundries || laundries.length === 0) && <div className="text-sm font-medium text-muted">Nessuna ancora.</div>}
          </div>
          <form action={createLaundry} className="mt-4 space-y-2">
            <input name="name" placeholder="Nome lavanderia" className={input} />
            <div className="flex gap-2">
              <select name="zone_id" className={input} defaultValue="">
                <option value="">Zona…</option>
                {(zones ?? []).map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
              <Button type="submit" size="md" variant="ghost-navy">+</Button>
            </div>
          </form>
        </Card>

        {/* SLOT */}
        <Card className="lg:col-span-2">
          <h2 className="font-display text-base font-extrabold text-navy">Slot (ritiro / consegna)</h2>
          <form action={createSlot} className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <select name="kind" className={input} defaultValue="pickup">
              <option value="pickup">Ritiro</option>
              <option value="delivery">Consegna</option>
            </select>
            <select name="zone_id" className={input} defaultValue="">
              <option value="">Zona…</option>
              {(zones ?? []).map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
            <input name="date" type="date" className={input} />
            <input name="from" type="time" className={input} />
            <input name="to" type="time" className={input} />
            <Button type="submit" size="md" variant="ghost-navy">Crea slot</Button>
          </form>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(slots ?? []).map((s) => (
              <div key={s.id} className="rounded-[14px] border border-line bg-ice px-3.5 py-2.5 text-sm">
                <span className="font-display text-xs font-bold uppercase text-blue">{s.kind === "pickup" ? "Ritiro" : "Consegna"}</span>
                <div className="font-semibold text-navy">
                  {new Date(s.starts_at).toLocaleString("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="text-xs font-medium text-muted">{s.zones?.name ?? "Tutte le zone"}</div>
              </div>
            ))}
            {(!slots || slots.length === 0) && <div className="text-sm font-medium text-muted">Nessuno slot futuro.</div>}
          </div>
        </Card>
      </div>
    </>
  );
}
