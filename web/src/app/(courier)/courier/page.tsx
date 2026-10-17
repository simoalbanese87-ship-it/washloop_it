import { Card, PageTitle } from "@/components/app/AppShell";
import { CourierJobCard, type Job } from "@/components/app/CourierJobCard";
import { RiderScanner } from "@/components/app/RiderScanner";
import { RiderLocationPinger } from "@/components/app/RiderLocationPinger";
import { RiderMapLoader } from "@/components/app/RiderMapLoader";
import type { Stop, Depot } from "@/components/app/RiderMap";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { fmtSlot, entroOggiRoma, fineGiornataRomaMs } from "@/lib/format";
import { AZIONABILI, IN_LAVORAZIONE, daCaricareOggi } from "@/lib/consegne-da-caricare";
import { ConsegnaDaCaricare } from "@/components/app/ConsegnaDaCaricare";
import { CompitoCard } from "@/components/app/CompitoCard";
import { compitiDaFare } from "@/lib/compiti-sync";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import { optimizeOrder, partenzaDelGiro } from "@/lib/route";
import type { OrderStatus, AccessMode } from "@/lib/orders";

type Row = {
  id: string;
  status: OrderStatus;
  bags: number;
  customer: { full_name: string | null; phone: string | null; client_code: string | null; tags_delivered_at: string | null } | null;
  addresses: { street: string; lat: number | null; lng: number | null; zones: { name: string } | null; access_mode: string | null; access_note: string | null } | null;
  pickup_slot: { starts_at: string; ends_at: string } | null;
  delivery_slot: { starts_at: string; ends_at: string } | null;
  laundry_id: string | null;
  laundries: { name: string; lat: number | null; lng: number | null } | null;
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
    // Solo sui ritiri: su una consegna il sacco torna al cliente, e da dove
    // viene non gli serve.
    laundry: kind === "pickup" ? uno(r.laundries)?.name ?? null : null,
  };
}

/** Un embed uno-a-uno torna oggetto o array a seconda di come lo tipizza il
 *  client: si legge da un posto solo. */
const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export default async function CourierToday() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data }, { data: depotRow }, compiti] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, bags, laundry_id, laundries(name, lat, lng), customer:profiles!orders_customer_id_fkey(full_name, phone, client_code, tags_delivered_at), addresses(street, lat, lng, zones(name), access_mode, access_note), pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)",
      )
      .eq("courier_id", profile?.id ?? "")
      // Anche gli stati in cui il sacco è dentro la lavanderia: da li' nasce
      // la sezione «Da caricare», dove il rider non aspetta nessuno.
      .in("status", [...AZIONABILI, ...IN_LAVORAZIONE])
      .returns<Row[]>(),
    supabase.from("depots").select("lat, lng").eq("active", true).limit(1).maybeSingle<{ lat: number | null; lng: number | null }>(),
    // Materiale da portare e da recuperare. Non sono fermate: non hanno una
    // fascia, non entrano nel percorso e non fanno avanzare nessun ordine.
    // `soloVisibili` tiene fuori i rientri programmati di chi ha disdetto ma
    // è ancora servito fino al rinnovo.
    compitiDaFare({ riderId: profile?.id ?? "", soloVisibili: true }),
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
  const rows = tutte.filter((r) => AZIONABILI.includes(r.status) && entroOggiRoma(slotOf(r)?.starts_at));
  // Le consegne di oggi ancora dentro la lavanderia. Non sono fermate: sono
  // sacchi da caricare, e il rider non deve aspettare che qualcuno di là prema
  // un bottone per poterci lavorare.
  const daCaricare = daCaricareOggi(
    tutte.map((r) => ({ riga: r, status: r.status, riconsegnaIso: r.delivery_slot?.starts_at ?? null })),
    fineGiornataRomaMs(),
  ).map((x) => x.riga);
  const piuAvanti = tutte.filter((r) => AZIONABILI.includes(r.status)).length - rows.length;

  // Deposito = hub logistico interno (tabella depots). Solo lato rider, mai al cliente.
  const depot: Depot = depotRow?.lat != null && depotRow?.lng != null ? { lat: depotRow.lat, lng: depotRow.lng } : null;
  // I sacchi puliti si caricano **nella lavanderia di quell'ordine**, non in
  // una lavanderia qualsiasi. Finché ce n'era una sola bastava pescarla con un
  // `limit(1)`; con la stireria di Arluno quella riga manderebbe il rider a
  // cinquanta chilometri dai sacchi che deve caricare.
  const primaConsegna = [...rows]
    .filter((r) => kindOf(r) === "delivery")
    .sort((a, b) => (slotOf(a)?.starts_at ?? "").localeCompare(slotOf(b)?.starts_at ?? ""))[0];
  const lavPrima = uno(primaConsegna?.laundries ?? null);
  const lavanderia: Depot = lavPrima?.lat != null && lavPrima?.lng != null ? { lat: lavPrima.lat, lng: lavPrima.lng } : null;

  // Fermate con coordinate → ottimizzazione; senza coord → in coda per orario.
  const geo = rows.filter((r) => r.addresses?.lat != null && r.addresses?.lng != null);
  const noGeo = rows.filter((r) => !(r.addresses?.lat != null && r.addresses?.lng != null))
    .sort((a, b) => (slotOf(a)?.ends_at ?? "").localeCompare(slotOf(b)?.ends_at ?? ""));

  // La prima cosa in ordine di orario decide da dove si parte: una giornata di
  // sole consegne comincia in lavanderia, una che apre con un ritiro comincia
  // dal deposito.
  const primaPerOrario = [...rows].sort((a, b) =>
    (slotOf(a)?.starts_at ?? "").localeCompare(slotOf(b)?.starts_at ?? ""),
  )[0];
  const siParteConUnaConsegna = !!primaPerOrario && kindOf(primaPerOrario) === "delivery";
  const partenza = partenzaDelGiro(siParteConUnaConsegna, lavanderia, depot);

  const order = optimizeOrder(
    partenza,
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

  // Gli scarichi: una fermata per ogni lavanderia dove finiscono i sacchi
  // ritirati oggi. Senza, il giro si fermava all'ultimo cliente e il rider
  // doveva sapersi da sé che quei due sacchi vanno ad Arluno e gli altri a
  // Zanica.
  const scarichi = new Map<string, { nome: string; lat: number; lng: number; sacchi: number }>();
  for (const r of rows) {
    if (kindOf(r) !== "pickup" || !r.laundry_id) continue;
    const lav = uno(r.laundries);
    if (lav?.lat == null || lav?.lng == null) continue;
    const gia = scarichi.get(r.laundry_id);
    if (gia) gia.sacchi += r.bags ?? 0;
    else scarichi.set(r.laundry_id, { nome: lav.name, lat: lav.lat, lng: lav.lng, sacchi: r.bags ?? 0 });
  }
  const fermateScarico: Stop[] = [...scarichi.values()].map((s, i) => ({
    id: `scarico-${i}`,
    kind: "laundry" as const,
    n: stops.length + i + 1,
    lat: s.lat,
    lng: s.lng,
    name: s.nome,
    address: `${s.sacchi} ${s.sacchi === 1 ? "sacco" : "sacchi"} da scaricare`,
    when: null,
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
        sub={`${pickups.length} ritiri · ${deliveries.length} consegne${compiti.length > 0 ? ` · ${compiti.length} ${compiti.length === 1 ? "compito" : "compiti"}` : ""}${daCaricare.length > 0 ? ` · ${daCaricare.length} da caricare` : ""}${piuAvanti > 0 ? ` · ${piuAvanti} ${piuAvanti === 1 ? "fermata" : "fermate"} nei prossimi giorni, non ${piuAvanti === 1 ? "è" : "sono"} da fare oggi` : ""}`}
      />

      {compiti.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-extrabold text-navy">
              Materiale da portare o recuperare ({compiti.length})
            </h2>
            <span className="text-xs font-medium text-muted">Caricalo prima di partire.</span>
          </div>
          <div className="space-y-3">
            {compiti.map((c) => (
              <CompitoCard
                key={c.id}
                compito={{
                  id: c.id,
                  tipo: c.tipo,
                  cliente: c.cliente,
                  clientCode: c.clientCode,
                  indirizzo: c.indirizzo,
                  zona: c.zona,
                  telefono: c.telefono,
                  scadeIl: c.scadeIl,
                  inRitardo: c.inRitardo,
                  manca: c.manca,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {daCaricare.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-extrabold text-navy">
              Da caricare in lavanderia ({daCaricare.length})
            </h2>
            <span className="text-xs font-medium text-muted">
              Il giro parte da qui: carica e premi, non aspettare.
            </span>
          </div>
          <div className="space-y-3">
            {daCaricare.map((r) => (
              <ConsegnaDaCaricare
                key={r.id}
                job={{
                  id: r.id,
                  cliente: r.customer?.full_name ?? "Cliente",
                  indirizzo: r.addresses?.street ?? "—",
                  zona: r.addresses?.zones?.name ?? "—",
                  quando: fmt(r.delivery_slot),
                  bags: r.bags,
                  statoTesto: ORDER_STATUS_LABEL[r.status] ?? r.status,
                }}
              />
            ))}
          </div>
        </section>
      )}

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
          <RiderMapLoader stops={[...stops, ...fermateScarico]} depot={partenza} />
        </Card>
      )}

      {/* Dove finiscono i sacchi di oggi. Si scrive solo quando i posti sono
          più d'uno: con una lavanderia sola sarebbe una riga che dice una cosa
          che il rider sa già. */}
      {fermateScarico.length > 1 && (
        <Card className="mb-6">
          <h2 className="font-display text-base font-extrabold text-navy">A fine giro, scarica così</h2>
          <ul className="mt-2 space-y-1.5">
            {fermateScarico.map((f) => (
              <li key={f.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-display font-bold text-navy">{f.name}</span>
                <span className="font-medium text-muted">{f.address}</span>
              </li>
            ))}
          </ul>
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
      {/* La seconda sezione prende un titolo solo quando c'e' anche la prima:
          da sola e' tutta la pagina e non serve dirlo. */}
      {daCaricare.length > 0 && routeRows.length > 0 && (
        <h2 className="mb-2 font-display text-base font-extrabold text-navy">In giro adesso ({routeRows.length})</h2>
      )}

      {routeRows.length > 0 ? (
        <div className="space-y-3">
          {routeRows.map((r, i) => (
            <CourierJobCard key={r.id} job={toJob(r, kindOf(r))} n={i + 1} kind={kindOf(r)} />
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-sm font-medium text-muted">
            {daCaricare.length > 0
              ? "Il giro vero comincia quando carichi: premi «Ho caricato i sacchi» qui sopra e la consegna compare qui."
              : piuAvanti > 0
                ? "Niente da fare oggi. Le fermate dei prossimi giorni compaiono qui la mattina stessa."
                : compiti.length > 0
                  ? "Nessuna fermata oggi: resta il materiale da portare o recuperare qui sopra."
                  : "Nessuna fermata assegnata."}
          </p>
        </Card>
      )}

      {routeRows.length > 0 && (
        <p className="mt-3 text-[11px] font-medium text-muted">
          {partenza
            ? siParteConUnaConsegna
              ? `Percorso calcolato partendo dalla lavanderia${lavPrima?.name ? ` (${lavPrima.name})` : ""}, dove carichi i sacchi puliti.`
              : "Percorso calcolato partendo dal deposito."
            : "Nessun punto di partenza impostato: l'ordine delle fermate segue solo gli orari. L'admin lo configura nel Catalogo."}
        </p>
      )}

    </>
  );
}

const ClockIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
