import { Card, PageTitle } from "@/components/app/AppShell";
import { CourierJobCard, type Job } from "@/components/app/CourierJobCard";
import { RiderScanner } from "@/components/app/RiderScanner";
import { RiderMapLoader } from "@/components/app/RiderMapLoader";
import type { Stop, Depot } from "@/components/app/RiderMap";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { fmtSlot } from "@/lib/format";
import { optimizeOrder } from "@/lib/route";
import type { OrderStatus, AccessMode } from "@/lib/orders";

type Row = {
  id: string;
  status: OrderStatus;
  bags: number;
  customer: { full_name: string | null; phone: string | null } | null;
  addresses: { street: string; lat: number | null; lng: number | null; zones: { name: string } | null; access_mode: string | null; access_note: string | null } | null;
  laundries: { lat: number | null; lng: number | null } | null;
  pickup_slot: { starts_at: string; ends_at: string } | null;
  delivery_slot: { starts_at: string; ends_at: string } | null;
};

function fmt(s: { starts_at: string; ends_at: string } | null): string | null {
  return s ? fmtSlot(s.starts_at, s.ends_at) : null;
}
function hhmm(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try { return new Date(iso).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }); } catch { return null; }
}

function toJob(r: Row, kind: "pickup" | "delivery"): Job {
  return {
    id: r.id, status: r.status,
    customer: r.customer?.full_name ?? "Cliente",
    address: r.addresses?.street ?? "—",
    zone: r.addresses?.zones?.name ?? "—",
    phone: r.customer?.phone ?? null,
    bags: r.bags,
    when: fmt(kind === "pickup" ? r.pickup_slot : r.delivery_slot),
    accessMode: (r.addresses?.access_mode ?? "door") as AccessMode,
    accessNote: r.addresses?.access_note ?? null,
  };
}

export default async function CourierToday() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, bags, customer:profiles!orders_customer_id_fkey(full_name, phone), addresses(street, lat, lng, zones(name), access_mode, access_note), laundries(lat, lng), pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)",
    )
    .eq("courier_id", profile?.id ?? "")
    .in("status", ["pickup_scheduled", "delivery_scheduled", "out_for_delivery"])
    .returns<Row[]>();

  const rows = data ?? [];
  const kindOf = (r: Row): "pickup" | "delivery" => (r.status === "pickup_scheduled" ? "pickup" : "delivery");
  const slotOf = (r: Row) => (kindOf(r) === "pickup" ? r.pickup_slot : r.delivery_slot);

  // Deposito = coordinate della lavanderia (prima disponibile). Solo lato rider.
  const depot: Depot = (() => {
    const l = rows.find((r) => r.laundries?.lat != null && r.laundries?.lng != null)?.laundries;
    return l && l.lat != null && l.lng != null ? { lat: l.lat, lng: l.lng } : null;
  })();

  // Fermate con coordinate → ottimizzazione; senza coord → in coda per orario.
  const geo = rows.filter((r) => r.addresses?.lat != null && r.addresses?.lng != null);
  const noGeo = rows.filter((r) => !(r.addresses?.lat != null && r.addresses?.lng != null))
    .sort((a, b) => (slotOf(a)?.ends_at ?? "").localeCompare(slotOf(b)?.ends_at ?? ""));

  const order = optimizeOrder(
    depot,
    geo.map((r) => ({ lat: r.addresses!.lat!, lng: r.addresses!.lng!, deadlineMs: slotOf(r)?.ends_at ? Date.parse(slotOf(r)!.ends_at) : null })),
  );
  const geoOrdered = order.map((i) => geo[i]);
  const routeRows = [...geoOrdered, ...noGeo];

  // Fermate mappa (numerate nell'ordine di visita).
  const stops: Stop[] = geoOrdered.map((r, i) => ({
    id: r.id, kind: kindOf(r), n: i + 1,
    lat: r.addresses!.lat!, lng: r.addresses!.lng!,
    name: r.customer?.full_name ?? "Cliente",
    address: r.addresses?.street ?? "—",
    when: fmt(slotOf(r)),
  }));

  const pickups = rows.filter((r) => r.status === "pickup_scheduled");
  const deliveries = rows.filter((r) => r.status !== "pickup_scheduled");

  // Deadline giro = ultimo orario di fine slot tra le fermate.
  const finish = rows.map((r) => slotOf(r)?.ends_at).filter(Boolean).sort().slice(-1)[0] ?? null;

  return (
    <>
      <PageTitle kicker="Il tuo giro" title="Oggi" sub={`${pickups.length} ritiri · ${deliveries.length} consegne`} />

      <div className="mb-6"><RiderScanner /></div>

      {finish && (
        <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-navy px-4 py-3 text-white">
          <ClockIcon />
          <span className="font-display text-sm font-extrabold">Chiudi il giro entro le {hhmm(finish)}</span>
        </div>
      )}

      {stops.length > 0 && (
        <Card className="mb-6 overflow-hidden !p-0">
          <RiderMapLoader stops={stops} depot={depot} />
        </Card>
      )}

      {/* Percorso ottimizzato */}
      {routeRows.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 font-display text-lg font-extrabold text-navy">Percorso ottimizzato</h2>
          <ol className="space-y-2">
            {routeRows.map((r, i) => {
              const kind = kindOf(r);
              const isPickup = kind === "pickup";
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-[14px] border border-line bg-white px-3 py-2.5">
                  <span className={`grid h-7 w-7 flex-none place-items-center rounded-full font-display text-xs font-black text-white ${isPickup ? "bg-[#2b7fd4]" : "bg-[#1F8A5B]"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-extrabold text-navy">{r.customer?.full_name ?? "Cliente"}</span>
                      <span className={`rounded-full px-2 py-0.5 font-display text-[10px] font-bold ${isPickup ? "bg-[#2b7fd4]/12 text-[#2b7fd4]" : "bg-[#1F8A5B]/12 text-[#1F8A5B]"}`}>{isPickup ? "Ritiro" : "Consegna"}</span>
                      <span className="rounded-full bg-ice px-2 py-0.5 font-display text-[10px] font-bold text-navy">{r.bags} {r.bags === 1 ? "busta" : "buste"}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium text-muted">{r.addresses?.street ?? "—"}</div>
                  </div>
                  {slotOf(r)?.ends_at && <span className="flex-none font-display text-xs font-bold text-navy/60">entro {hhmm(slotOf(r)!.ends_at)}</span>}
                </li>
              );
            })}
          </ol>
          {!depot && <p className="mt-3 text-[11px] font-medium text-muted">Deposito non impostato: aggiungi l&apos;indirizzo della lavanderia nel Catalogo per partenza/rientro sul percorso.</p>}
        </Card>
      )}

      {/* Azioni: ritiri / consegne */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-lg font-extrabold text-navy">Ritiri</h2>
          <div className="space-y-3">
            {pickups.length > 0 ? (
              pickups.map((r) => <CourierJobCard key={r.id} job={toJob(r, "pickup")} />)
            ) : (
              <Card><p className="text-sm font-medium text-muted">Nessun ritiro assegnato.</p></Card>
            )}
          </div>
        </section>
        <section>
          <h2 className="mb-3 font-display text-lg font-extrabold text-navy">Consegne</h2>
          <div className="space-y-3">
            {deliveries.length > 0 ? (
              deliveries.map((r) => <CourierJobCard key={r.id} job={toJob(r, "delivery")} />)
            ) : (
              <Card><p className="text-sm font-medium text-muted">Nessuna consegna assegnata.</p></Card>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

const ClockIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
