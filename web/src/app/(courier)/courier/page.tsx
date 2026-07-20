import { Card, PageTitle } from "@/components/app/AppShell";
import { CourierJobCard, type Job } from "@/components/app/CourierJobCard";
import { RiderScanner } from "@/components/app/RiderScanner";
import { RiderMapLoader } from "@/components/app/RiderMapLoader";
import type { Stop } from "@/components/app/RiderMap";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { fmtSlot } from "@/lib/format";
import type { OrderStatus, AccessMode } from "@/lib/orders";

type Row = {
  id: string;
  status: OrderStatus;
  bags: number;
  customer: { full_name: string | null; phone: string | null } | null;
  addresses: { street: string; lat: number | null; lng: number | null; zones: { name: string } | null; access_mode: string | null; access_note: string | null } | null;
  pickup_slot: { starts_at: string; ends_at: string } | null;
  delivery_slot: { starts_at: string; ends_at: string } | null;
};

function fmt(s: { starts_at: string; ends_at: string } | null): string | null {
  return s ? fmtSlot(s.starts_at, s.ends_at) : null;
}

function toJob(r: Row, kind: "pickup" | "delivery"): Job {
  return {
    id: r.id,
    status: r.status,
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
      "id, status, bags, customer:profiles!orders_customer_id_fkey(full_name, phone), addresses(street, lat, lng, zones(name), access_mode, access_note), pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)",
    )
    .eq("courier_id", profile?.id ?? "")
    .in("status", ["pickup_scheduled", "delivery_scheduled", "out_for_delivery"])
    .returns<Row[]>();

  const rows = data ?? [];
  const pickups = rows
    .filter((r) => r.status === "pickup_scheduled")
    .sort((a, b) => (a.pickup_slot?.starts_at ?? "").localeCompare(b.pickup_slot?.starts_at ?? ""));
  const deliveries = rows
    .filter((r) => r.status === "delivery_scheduled" || r.status === "out_for_delivery")
    .sort((a, b) => (a.delivery_slot?.starts_at ?? "").localeCompare(b.delivery_slot?.starts_at ?? ""));

  // Fermate geolocalizzate per la mappa (numerate per tipo, ordine = orario slot).
  const toStop = (r: Row, kind: "pickup" | "delivery", n: number): Stop | null => {
    const lat = r.addresses?.lat, lng = r.addresses?.lng;
    if (lat == null || lng == null) return null;
    return {
      id: r.id, kind, n, lat, lng,
      name: r.customer?.full_name ?? "Cliente",
      address: r.addresses?.street ?? "—",
      when: fmt(kind === "pickup" ? r.pickup_slot : r.delivery_slot),
    };
  };
  const stops: Stop[] = [
    ...pickups.map((r, i) => toStop(r, "pickup", i + 1)),
    ...deliveries.map((r, i) => toStop(r, "delivery", i + 1)),
  ].filter((s): s is Stop => s !== null);

  return (
    <>
      <PageTitle kicker="Il tuo giro" title="Oggi" sub={`${pickups.length} ritiri · ${deliveries.length} consegne`} />

      <div className="mb-6">
        <RiderScanner />
      </div>

      {stops.length > 0 && (
        <Card className="mb-6 overflow-hidden !p-0">
          <RiderMapLoader stops={stops} />
        </Card>
      )}

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
