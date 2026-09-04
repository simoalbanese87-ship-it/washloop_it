import { Card, PageTitle } from "@/components/app/AppShell";
import { CourierJobCard, type Job } from "@/components/app/CourierJobCard";
import { RiderScanner } from "@/components/app/RiderScanner";
import { RiderLocationPinger } from "@/components/app/RiderLocationPinger";
import { RiderMapLoader } from "@/components/app/RiderMapLoader";
import type { Stop, Depot } from "@/components/app/RiderMap";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { fmtSlot, entroOggiRoma } from "@/lib/format";
import { optimizeOrder } from "@/lib/route";
import type { OrderStatus, AccessMode } from "@/lib/orders";

type Row = {
  id: string;
  status: OrderStatus;
  bags: number;
  customer: { full_name: string | null; phone: string | null; client_code: string | null; tags_delivered_at: string | null } | null;
  addresses: { street: string; lat: number | null; lng: number | null; zones: { name: string } | null; access_mode: string | null; access_note: string | null } | null;
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
    clientCode: r.customer?.client_code ?? null,
    tagConsegnati: !!r.customer?.tags_delivered_at,
    bags: r.bags,
    when: fmt(kind === "pickup" ? r.pickup_slot : r.delivery_slot),
    accessMode: (r.addresses?.access_mode ?? "door") as AccessMode,
    accessNote: r.addresses?.access_note ?? null,
  };
}

export default async function CourierToday() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data }, { data: depotRow }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, bags, customer:profiles!orders_customer_id_fkey(full_name, phone, client_code, tags_delivered_at), addresses(street, lat, lng, zones(name), access_mode, access_note), pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)",
      )
      .eq("courier_id", profile?.id ?? "")
      .in("status", ["pickup_scheduled", "delivery_scheduled", "out_for_delivery"])
      .returns<Row[]>(),
    supabase.from("depots").select("lat, lng").eq("active", true).limit(1).maybeSingle<{ lat: number | null; lng: number | null }>(),
  ]);

  const tutte = data ?? [];
  const kindOf = (r: Row): "pickup" | "delivery" => (r.status === "pickup_scheduled" ? "pickup" : "delivery");
  const slotOf = (r: Row) => (kindOf(r) === "pickup" ? r.pickup_slot : r.delivery_slot);

  // Il giro è di OGGI, e finora questa pagina non lo era: mostrava ogni fermata
  // aperta del rider, compresi i ritiri fissati fra due o tre settimane. Con un
  // abbonato che ha già in calendario i ritiri di tutto il mese, il rider si
  // trovava tre schede identiche — stesso nome, stesso indirizzo, «1 busta» —
  // e nessun modo di sapere quale fosse quella del giorno. È successo il primo
  // giorno di lavoro vero: due sacchi sono stati registrati sui ritiri del 9 e
  // del 23 settembre, e in lavanderia sono comparse lavorazioni con «pronto
  // entro» a fine mese.
  //
  // Passa il taglio chi ha la fascia entro stasera. Le fermate arretrate — slot
  // di ieri mai chiuso — restano: vanno recuperate, non nascoste. Chi non ha
  // ancora una fascia (riconsegna da programmare) resta a vista per lo stesso
  // motivo.
  const rows = tutte.filter((r) => entroOggiRoma(slotOf(r)?.starts_at));
  const piuAvanti = tutte.length - rows.length;

  // Deposito = hub logistico interno (tabella depots). Solo lato rider, mai al cliente.
  const depot: Depot = depotRow?.lat != null && depotRow?.lng != null ? { lat: depotRow.lat, lng: depotRow.lng } : null;

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
      <PageTitle
        kicker="Il tuo giro"
        title="Oggi"
        sub={`${pickups.length} ritiri · ${deliveries.length} consegne${piuAvanti > 0 ? ` · ${piuAvanti} ${piuAvanti === 1 ? "fermata" : "fermate"} nei prossimi giorni, non ${piuAvanti === 1 ? "è" : "sono"} da fare oggi` : ""}`}
      />

      <div className="mb-4"><RiderScanner /></div>
      <div className="mb-6"><RiderLocationPinger /></div>

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

      {/* Il giro, in un posto solo.
          Prima questa pagina raccontava le stesse fermate tre volte: un elenco
          numerato «Percorso ottimizzato» che non faceva niente, e sotto due
          sezioni separate «Ritiri» e «Consegne» con le schede su cui si preme —
          in un ordine diverso da quello dell'elenco. Il rider leggeva l'ordine
          in cima e poi doveva ritrovare la persona più in basso, in una delle
          due liste. Ora c'è una lista sola, nell'ordine in cui si guida, e
          ogni riga è già la scheda con cui si lavora. */}
      {routeRows.length > 0 ? (
        <div className="space-y-3">
          {routeRows.map((r, i) => (
            <CourierJobCard key={r.id} job={toJob(r, kindOf(r))} n={i + 1} kind={kindOf(r)} />
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-sm font-medium text-muted">
            {piuAvanti > 0
              ? "Niente da fare oggi. Le fermate dei prossimi giorni compaiono qui la mattina stessa."
              : "Nessuna fermata assegnata."}
          </p>
        </Card>
      )}

      {!depot && routeRows.length > 0 && (
        <p className="mt-3 text-[11px] font-medium text-muted">
          Deposito non impostato: l&apos;admin lo configura nel Catalogo (sezione Deposito).
        </p>
      )}

    </>
  );
}

const ClockIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
