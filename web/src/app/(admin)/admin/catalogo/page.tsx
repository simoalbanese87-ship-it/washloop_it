import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import {
  createZone,
  toggleZone,
  deleteZone,
  createLaundry,
  updateLaundry,
  updatePlan,
  updatePlanPrice,
  createSlot,
  deleteSlot,
  generateSlots,
} from "@/lib/actions/admin";
import { fmtDateTime } from "@/lib/format";

type Zone = { id: string; name: string; active: boolean };
type Laundry = { id: string; name: string; zone_id: string | null; address: string | null; phone: string | null; email: string | null; active: boolean };
type Slot = { id: string; kind: string; starts_at: string; ends_at: string; laundries: { name: string } | null };
type Plan = { id: string; name: string; price_month_cents: number; turnaround_hours: number; pickups_per_week: number; active: boolean; stripe_price_id: string | null };

const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";
const DAYS = [
  { v: "1", l: "Lun" }, { v: "2", l: "Mar" }, { v: "3", l: "Mer" }, { v: "4", l: "Gio" },
  { v: "5", l: "Ven" }, { v: "6", l: "Sab" }, { v: "0", l: "Dom" },
];

export default async function CatalogoPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: zones }, { data: laundries }, { data: slots }, { data: plans }] = await Promise.all([
    supabase.from("zones").select("id, name, active").order("name").returns<Zone[]>(),
    supabase.from("laundries").select("id, name, zone_id, address, phone, email, active").order("name").returns<Laundry[]>(),
    supabase.from("slots").select("id, kind, starts_at, ends_at, laundries(name)").gte("starts_at", nowIso).order("starts_at").limit(60).returns<Slot[]>(),
    supabase.from("plans").select("id, name, price_month_cents, turnaround_hours, pickups_per_week, active, stripe_price_id").order("sort").returns<Plan[]>(),
  ]);

  return (
    <>
      <PageTitle kicker="Catalogo" title="Configurazione servizio" sub="Piani, lavanderie, zone e disponibilità slot." />

      <div className="space-y-6">
        {/* ---------- PIANI ---------- */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Piani</h2>
          <div className="mt-4 space-y-4">
            {(plans ?? []).map((p) => (
              <div key={p.id} className="rounded-[14px] border border-line p-4">
                <form action={updatePlan} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto_auto] sm:items-end">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <label className="text-xs font-bold text-muted">Nome<input name="name" defaultValue={p.name} className={input} /></label>
                  <label className="text-xs font-bold text-muted">€/mese<input name="price_eur" type="number" step="1" defaultValue={p.price_month_cents / 100} className={input} /></label>
                  <label className="text-xs font-bold text-muted">Pronto (h)<input name="turnaround_hours" type="number" defaultValue={p.turnaround_hours} className={input} /></label>
                  <label className="text-xs font-bold text-muted">Ritiri/sett<input name="pickups_per_week" type="number" defaultValue={p.pickups_per_week} className={input} /></label>
                  <label className="flex h-10 items-center gap-1.5 text-xs font-bold text-navy"><input type="checkbox" name="active" defaultChecked={p.active} className="accent-[#2b7fd4]" />Attivo</label>
                  <Button type="submit" size="md" variant="ghost-navy">Salva</Button>
                </form>
                <form action={updatePlanPrice} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <input name="stripe_price_id" defaultValue={p.stripe_price_id ?? ""} placeholder="Stripe price_..." className={`${input} flex-1`} />
                  <Button type="submit" size="md" variant="ghost-navy">Salva Price ID</Button>
                </form>
              </div>
            ))}
          </div>
        </Card>

        {/* ---------- LAVANDERIE ---------- */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Lavanderie partner</h2>
          <div className="mt-4 space-y-3">
            {(laundries ?? []).map((l) => (
              <form key={l.id} action={updateLaundry} className="grid gap-2 rounded-[14px] border border-line p-3 sm:grid-cols-[1.3fr_1fr_1.3fr_1fr_auto_auto] sm:items-center">
                <input type="hidden" name="id" value={l.id} />
                <input name="name" defaultValue={l.name} placeholder="Nome" className={input} />
                <select name="zone_id" defaultValue={l.zone_id ?? ""} className={input}>
                  <option value="">Zona…</option>
                  {(zones ?? []).map((z) => (<option key={z.id} value={z.id}>{z.name}</option>))}
                </select>
                <input name="address" defaultValue={l.address ?? ""} placeholder="Indirizzo" className={input} />
                <input name="phone" defaultValue={l.phone ?? ""} placeholder="Telefono" className={input} />
                <input name="email" type="email" defaultValue={l.email ?? ""} placeholder="Email (notifiche)" className={input} />
                <label className="flex h-10 items-center gap-1.5 text-xs font-bold text-navy"><input type="checkbox" name="active" defaultChecked={l.active} className="accent-[#2b7fd4]" />Attiva</label>
                <div className="flex gap-2">
                  <Button type="submit" size="md" variant="ghost-navy">Salva</Button>
                </div>
              </form>
            ))}
            {(!laundries || laundries.length === 0) && <p className="text-sm font-medium text-muted">Nessuna lavanderia.</p>}
          </div>
          <form action={createLaundry} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[1.3fr_1fr_1.3fr_1fr_auto]">
            <input name="name" required placeholder="Nuova lavanderia" className={input} />
            <select name="zone_id" defaultValue="" className={input}>
              <option value="">Zona…</option>
              {(zones ?? []).map((z) => (<option key={z.id} value={z.id}>{z.name}</option>))}
            </select>
            <input name="address" placeholder="Indirizzo" className={input} />
            <input name="phone" placeholder="Telefono" className={input} />
            <input name="email" type="email" placeholder="Email (notifiche)" className={input} />
            <Button type="submit" size="md">Aggiungi</Button>
          </form>
        </Card>

        {/* ---------- ZONE ---------- */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Zone</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(zones ?? []).map((z) => (
              <div key={z.id} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${z.active ? "border-line bg-ice" : "border-line bg-white opacity-50"}`}>
                <span className="text-sm font-semibold text-navy">{z.name}</span>
                <form action={toggleZone}>
                  <input type="hidden" name="id" value={z.id} />
                  <input type="hidden" name="active" value={(!z.active).toString()} />
                  <button type="submit" className="font-display text-[11px] font-bold text-blue hover:underline">{z.active ? "Disattiva" : "Attiva"}</button>
                </form>
                <form action={deleteZone}>
                  <input type="hidden" name="id" value={z.id} />
                  <button type="submit" className="font-display text-[11px] font-bold text-[#C0392B] hover:underline">✕</button>
                </form>
              </div>
            ))}
          </div>
          <form action={createZone} className="mt-4 flex gap-2">
            <input name="name" required placeholder="Nuova zona" className={`${input} max-w-xs`} />
            <Button type="submit" size="md" variant="ghost-navy">+</Button>
          </form>
        </Card>

        {/* ---------- GENERATORE SLOT ---------- */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Genera slot ricorrenti</h2>
          <p className="mt-1 text-sm font-medium text-muted">Crea automaticamente le fasce per più giorni in un colpo solo.</p>
          <form action={generateSlots} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-xs font-bold text-muted">Lavanderia
                <select name="laundry_id" required className={input} defaultValue="">
                  <option value="" disabled>Scegli…</option>
                  {(laundries ?? []).map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                </select>
              </label>
              <label className="text-xs font-bold text-muted">Tipo
                <select name="kind" className={input} defaultValue="pickup">
                  <option value="pickup">Ritiro</option>
                  <option value="delivery">Consegna</option>
                </select>
              </label>
              <label className="text-xs font-bold text-muted">Dal<input name="date_from" type="date" required className={input} /></label>
              <label className="text-xs font-bold text-muted">Al<input name="date_to" type="date" required className={input} /></label>
            </div>
            <div>
              <div className="text-xs font-bold text-muted">Giorni</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <label key={d.v} className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-line bg-ice px-3 py-1.5 text-sm font-semibold text-navy has-[:checked]:border-blue has-[:checked]:bg-blue/5">
                    <input type="checkbox" name="days" value={d.v} defaultChecked={d.v !== "0"} className="accent-[#2b7fd4]" />{d.l}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-5 sm:items-end">
              <label className="text-xs font-bold text-muted">Fascia 1 dalle<input name="w1_from" type="time" defaultValue="09:00" className={input} /></label>
              <label className="text-xs font-bold text-muted">alle<input name="w1_to" type="time" defaultValue="11:00" className={input} /></label>
              <label className="text-xs font-bold text-muted">Fascia 2 dalle<input name="w2_from" type="time" className={input} /></label>
              <label className="text-xs font-bold text-muted">alle<input name="w2_to" type="time" className={input} /></label>
              <label className="text-xs font-bold text-muted">Capacità<input name="capacity" type="number" defaultValue={10} className={input} /></label>
            </div>
            <Button type="submit" size="md">Genera slot</Button>
          </form>

          {/* Aggiunta singola */}
          <form action={createSlot} className="mt-5 grid gap-2 border-t border-line pt-4 sm:grid-cols-6">
            <select name="laundry_id" className={input} defaultValue="" required>
              <option value="" disabled>Lavanderia…</option>
              {(laundries ?? []).map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
            <select name="kind" className={input} defaultValue="pickup">
              <option value="pickup">Ritiro</option>
              <option value="delivery">Consegna</option>
            </select>
            <input name="date" type="date" className={input} />
            <input name="from" type="time" className={input} />
            <input name="to" type="time" className={input} />
            <Button type="submit" size="md" variant="ghost-navy">Slot singolo</Button>
          </form>
        </Card>

        {/* ---------- SLOT ESISTENTI ---------- */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Slot futuri ({slots?.length ?? 0})</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(slots ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-[12px] border border-line bg-ice px-3 py-2">
                <div className="text-sm">
                  <span className="font-display text-[11px] font-bold uppercase text-blue">{s.kind === "pickup" ? "Ritiro" : "Consegna"}</span>
                  <div className="font-semibold text-navy">{fmtDateTime(s.starts_at)}</div>
                  <div className="text-xs font-medium text-muted">{s.laundries?.name ?? "—"}</div>
                </div>
                <form action={deleteSlot}>
                  <input type="hidden" name="slot_id" value={s.id} />
                  <button type="submit" className="font-display text-xs font-bold text-[#C0392B] hover:underline">✕</button>
                </form>
              </div>
            ))}
            {(!slots || slots.length === 0) && <p className="text-sm font-medium text-muted">Nessuno slot futuro. Usa il generatore qui sopra.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
