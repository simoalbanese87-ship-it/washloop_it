import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import {
  createZone,
  toggleZone,
  deleteZone,
  setZoneCourier,
  backfillGeocode,
  updateDepot,
  createLaundry,
  updateLaundry,
  updatePlan,
  updatePlanPrice,
  createSlot,
  deleteSlot,
  generateSlots,
} from "@/lib/actions/admin";
import { DeleteLaundryButton } from "@/components/admin/DeleteLaundryButton";
import { fmtDateTime } from "@/lib/format";
import { pickupCounts, deliveryCounts } from "@/lib/slots";

type Zone = { id: string; name: string; active: boolean; courier_id: string | null };
type Courier = { id: string; full_name: string | null };
type DepotRow = { id: string; name: string; address: string | null; lat: number | null; lng: number | null };
type Laundry = { id: string; name: string; zone_id: string | null; address: string | null; phone: string | null; email: string | null; active: boolean };
type Slot = { id: string; kind: string; starts_at: string; ends_at: string; capacity: number | null; laundries: { name: string } | null };
type Plan = { id: string; name: string; price_month_cents: number; turnaround_hours: number; pickups_per_week: number; active: boolean; stripe_price_id: string | null };

const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";
const DAYS = [
  { v: "1", l: "Lun" }, { v: "2", l: "Mar" }, { v: "3", l: "Mer" }, { v: "4", l: "Gio" },
  { v: "5", l: "Ven" }, { v: "6", l: "Sab" }, { v: "0", l: "Dom" },
];

export default async function CatalogoPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: zones }, { data: laundries }, { data: slots }, { data: plans }, { data: couriers }] = await Promise.all([
    supabase.from("zones").select("id, name, active, courier_id").order("sort").order("name").returns<Zone[]>(),
    supabase.from("laundries").select("id, name, zone_id, address, phone, email, active").order("name").returns<Laundry[]>(),
    supabase.from("slots").select("id, kind, starts_at, ends_at, capacity, laundries(name)").gte("starts_at", nowIso).order("starts_at").limit(60).returns<Slot[]>(),
    supabase.from("plans").select("id, name, price_month_cents, turnaround_hours, pickups_per_week, active, stripe_price_id").order("sort").returns<Plan[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "courier").order("full_name").returns<Courier[]>(),
  ]);
  const { data: depot } = await supabase.from("depots").select("id, name, address, lat, lng").eq("active", true).limit(1).maybeSingle<DepotRow>();

  // Occupazione per slot: ordini non annullati agganciati (ritiro vs consegna).
  const pickIds = (slots ?? []).filter((s) => s.kind === "pickup").map((s) => s.id);
  const delivIds = (slots ?? []).filter((s) => s.kind === "delivery").map((s) => s.id);
  const [pCounts, dCounts] = await Promise.all([pickupCounts(supabase, pickIds), deliveryCounts(supabase, delivIds)]);
  const usedOf = (s: Slot) => (s.kind === "pickup" ? pCounts.get(s.id) : dCounts.get(s.id)) ?? 0;

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

        {/* ---------- DEPOSITO ---------- */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Deposito (hub interno)</h2>
          <p className="mt-1 text-sm font-medium text-muted">Punto di raccolta/rientro del furgone e partenza dei rider. Interno: <strong>mai visibile al cliente</strong>. L&apos;indirizzo viene geocodificato per il percorso e la mappa rider.</p>
          <form action={updateDepot} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1.6fr_auto] sm:items-end">
            {depot?.id && <input type="hidden" name="depot_id" value={depot.id} />}
            <label className="text-xs font-bold text-muted">Nome<input name="name" defaultValue={depot?.name ?? "Deposito Milano"} className={input} /></label>
            <label className="text-xs font-bold text-muted">Indirizzo<input name="address" defaultValue={depot?.address ?? ""} placeholder="Via, civico, CAP città" className={input} /></label>
            <Button type="submit" size="md">Salva deposito</Button>
          </form>
          <p className="mt-2 text-[11px] font-medium text-muted">
            {depot?.lat != null ? `Coordinate ok (${depot.lat.toFixed(4)}, ${depot.lng?.toFixed(4)}).` : "Coordinate non impostate: salva un indirizzo valido."}
          </p>
        </Card>

        {/* ---------- LAVANDERIE ---------- */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Lavanderie partner</h2>
          <div className="mt-4 space-y-3">
            {(laundries ?? []).map((l) => (
              <div key={l.id} className="rounded-[14px] border border-line p-3">
                <form action={updateLaundry} className="grid gap-2 sm:grid-cols-[1.3fr_1fr_1.3fr_1fr_auto_auto] sm:items-center">
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
                  <Button type="submit" size="md" variant="ghost-navy">Salva</Button>
                </form>
                <div className="mt-2 flex justify-end border-t border-line pt-2">
                  <DeleteLaundryButton id={l.id} name={l.name} />
                </div>
              </div>
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

        {/* ---------- ZONE + RIDER ---------- */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Zone &amp; rider</h2>
          <p className="mt-1 text-sm font-medium text-muted">Ogni zona può avere un rider dedicato: l&apos;auto-assegnazione manda i suoi ordini a lui. Le zone senza rider usano il bilanciamento automatico. Scalabile: aggiungi zone quando aumentano i rider.</p>

          {/* Zone attive: assegnazione rider */}
          <div className="mt-4 space-y-2">
            {(zones ?? []).filter((z) => z.active).map((z) => (
              <div key={z.id} className="grid gap-2 rounded-[14px] border border-line p-3 sm:grid-cols-[1.2fr_1.4fr_auto] sm:items-center">
                <span className="font-display text-sm font-extrabold text-navy">{z.name}</span>
                <form action={setZoneCourier} className="flex gap-2">
                  <input type="hidden" name="zone_id" value={z.id} />
                  <select name="courier_id" defaultValue={z.courier_id ?? ""} className={`${input} flex-1`}>
                    <option value="">Nessun rider (bilanciato)</option>
                    {(couriers ?? []).map((c) => (<option key={c.id} value={c.id}>{c.full_name ?? "Rider"}</option>))}
                  </select>
                  <Button type="submit" size="md" variant="ghost-navy">Salva</Button>
                </form>
                <div className="flex gap-2 sm:justify-end">
                  <form action={toggleZone}>
                    <input type="hidden" name="id" value={z.id} />
                    <input type="hidden" name="active" value="false" />
                    <button type="submit" className="font-display text-[11px] font-bold text-blue hover:underline">Disattiva</button>
                  </form>
                  <form action={deleteZone}>
                    <input type="hidden" name="id" value={z.id} />
                    <button type="submit" className="font-display text-[11px] font-bold text-[#C0392B] hover:underline">✕</button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          {/* Zone disattivate (storiche) */}
          {(zones ?? []).some((z) => !z.active) && (
            <div className="mt-3">
              <div className="text-xs font-bold text-muted">Zone disattivate</div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(zones ?? []).filter((z) => !z.active).map((z) => (
                  <div key={z.id} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 opacity-60">
                    <span className="text-sm font-semibold text-navy">{z.name}</span>
                    <form action={toggleZone}>
                      <input type="hidden" name="id" value={z.id} />
                      <input type="hidden" name="active" value="true" />
                      <button type="submit" className="font-display text-[11px] font-bold text-blue hover:underline">Attiva</button>
                    </form>
                    <form action={deleteZone}>
                      <input type="hidden" name="id" value={z.id} />
                      <button type="submit" className="font-display text-[11px] font-bold text-[#C0392B] hover:underline">✕</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <form action={createZone} className="flex gap-2">
              <input name="name" required placeholder="Nuova zona" className={`${input} max-w-xs`} />
              <Button type="submit" size="md" variant="ghost-navy">+ Aggiungi zona</Button>
            </form>
            <form action={backfillGeocode} className="ml-auto">
              <Button type="submit" size="md" variant="ghost-navy">Geocodifica indirizzi mancanti (15/volta)</Button>
            </form>
          </div>
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
            {(slots ?? []).map((s) => {
              const used = usedOf(s);
              const cap = s.capacity;
              const full = cap != null && used >= cap;
              const low = !full && cap != null && cap - used <= 3;
              return (
                <div key={s.id} className={`flex items-center justify-between rounded-[12px] border px-3 py-2 ${full ? "border-[#C0392B]/40 bg-[#C0392B]/[0.06]" : "border-line bg-ice"}`}>
                  <div className="text-sm">
                    <span className="font-display text-[11px] font-bold uppercase text-blue">{s.kind === "pickup" ? "Ritiro" : "Consegna"}</span>
                    <div className="font-semibold text-navy">{fmtDateTime(s.starts_at)}</div>
                    <div className="text-xs font-medium text-muted">{s.laundries?.name ?? "—"}</div>
                    <div className={`mt-0.5 font-display text-xs font-extrabold ${full ? "text-[#C0392B]" : low ? "text-[#C9881F]" : "text-[#1F8A5B]"}`}>
                      {used}/{cap ?? "∞"} occupati{full ? " · pieno" : ""}
                    </div>
                  </div>
                  <form action={deleteSlot}>
                    <input type="hidden" name="slot_id" value={s.id} />
                    <button type="submit" className="font-display text-xs font-bold text-[#C0392B] hover:underline">✕</button>
                  </form>
                </div>
              );
            })}
            {(!slots || slots.length === 0) && <p className="text-sm font-medium text-muted">Nessuno slot futuro. Usa il generatore qui sopra.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
