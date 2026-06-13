import { Card, PageTitle } from "@/components/app/AppShell";
import { CourierJobCard, type Job } from "@/components/app/CourierJobCard";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { OrderStatus } from "@/lib/orders";

type Row = {
  id: string;
  status: OrderStatus;
  bags: number;
  customer: { full_name: string | null; phone: string | null } | null;
  addresses: { street: string; zones: { name: string } | null } | null;
  pickup_slot: { starts_at: string; ends_at: string } | null;
  delivery_slot: { starts_at: string; ends_at: string } | null;
};

function fmt(s: { starts_at: string; ends_at: string } | null): string | null {
  if (!s) return null;
  const d = new Date(s.starts_at);
  const e = new Date(s.ends_at);
  return `${d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}–${e.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
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
  };
}

export default async function CourierToday() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, bags, customer:profiles!orders_customer_id_fkey(full_name, phone), addresses(street, zones(name)), pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)",
    )
    .eq("courier_id", profile?.id ?? "")
    .in("status", ["pickup_scheduled", "delivery_scheduled", "out_for_delivery"])
    .returns<Row[]>();

  const rows = data ?? [];
  const pickups = rows.filter((r) => r.status === "pickup_scheduled");
  const deliveries = rows.filter((r) => r.status === "delivery_scheduled" || r.status === "out_for_delivery");

  return (
    <>
      <PageTitle kicker="Il tuo giro" title="Oggi" sub={`${pickups.length} ritiri · ${deliveries.length} consegne`} />

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
