import Link from "next/link";
import { PageTitle } from "@/components/app/AppShell";
import { OrdersBoard, type BoardOrder } from "@/components/app/OrdersBoard";
import { adessoDelRender } from "@/lib/board-periodo";
import { ArchiveList, type ArchiveRow } from "@/components/app/ArchiveList";
import { createClient } from "@/lib/supabase/server";
import { ordineAperto, type OrderStatus } from "@/lib/orders";
import { daRisistemare } from "@/lib/riconsegna";
import { fmtFull } from "@/lib/format";

/** PostgREST tipizza gli embed uno-a-uno come oggetto ma può restituirli come
 *  array di uno: leggere `archived_at` su quello sbagliato dà `undefined`, e
 *  l'ordine orfano non comparirebbe proprio nel pannello che serve a trovarlo. */
const unoSolo = <T,>(v: T | T[] | null | undefined): T | null =>
  (Array.isArray(v) ? v[0] ?? null : v ?? null);

type Row = {
  id: string;
  status: OrderStatus;
  bags: number;
  created_at: string;
  eta_ready_at: string | null;
  courier_id: string | null;
  laundry_id: string | null;
  customer: { full_name: string | null; phone: string | null; is_test: boolean } | null;
  addresses: { zones: { name: string } | null } | null;
  laundries: { name: string } | null;
  courier: { full_name: string | null } | null;
  pickup_slot: { starts_at: string; archived_at: string | null } | null;
  delivery_slot: { starts_at: string; archived_at: string | null } | null;
};
type Opt = { id: string; name: string };

export default async function AdminBoard({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string; filtro?: string; stato?: string; prova?: string }>;
}) {
  const { ok, warn, filtro, stato, prova } = await searchParams;
  const includiProva = prova === "1";
  const supabase = await createClient();

  // Gli ordini chiusi erano una pagina a sé ("Archivio"), e "consegnati"
  // compariva in due posti. Ora sono un filtro di questa: stessa lista, stesso
  // indirizzo, nessun dubbio su dove cercare un ordine.
  if (stato === "conclusi") {
    const { data: chiusi } = await supabase
      .from("orders")
      .select("id, status, created_at, bags, customer:profiles!orders_customer_id_fkey(full_name), addresses(zones(name)), laundries(name), courier:profiles!orders_courier_id_fkey(full_name)")
      .in("status", ["delivered", "completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<{ id: string; status: OrderStatus; created_at: string; bags: number; customer: { full_name: string | null } | null; addresses: { zones: { name: string } | null } | null; laundries: { name: string } | null; courier: { full_name: string | null } | null }[]>();

    const lista: ArchiveRow[] = (chiusi ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      bags: r.bags,
      customer_name: r.customer?.full_name ?? null,
      zone_name: r.addresses?.zones?.name ?? null,
      laundry_name: r.laundries?.name ?? null,
      courier_name: r.courier?.full_name ?? null,
    }));

    return (
      <>
        <PageTitle kicker="Ordini" title="Conclusi" sub={`${lista.length} consegnati, completati o annullati`} />
        <div className="mb-4">
          <Link href="/admin/ordini" className="font-display text-sm font-bold text-blue hover:underline">← Torna agli ordini aperti</Link>
        </div>
        <ArchiveList rows={lista} />
      </>
    );
  }

  const [{ data: rows }, { data: couriers }, { data: laundries }, { data: zones }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, bags, created_at, eta_ready_at, courier_id, laundry_id, " +
          "customer:profiles!orders_customer_id_fkey(full_name, phone, is_test), " +
          "addresses(zones(name)), laundries(name), " +
          "courier:profiles!orders_courier_id_fkey(full_name), " +
          "pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, archived_at), " +
          "delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, archived_at)",
      )
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .returns<Row[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "courier").returns<{ id: string; full_name: string | null }[]>(),
    supabase.from("laundries").select("id, name").eq("active", true).returns<Opt[]>(),
    supabase.from("zones").select("id, name").eq("active", true).order("name").returns<Opt[]>(),
  ]);

  // Gli ordini di prova non stanno nel board: erano i 5 di Mario Test, tutti
  // "in ritardo" dal 20 giugno, e riempivano i contatori di cose che nessuno
  // avrebbe mai sistemato.
  const visibili = (rows ?? []).filter((r) => includiProva || !r.customer?.is_test);

  const orders: BoardOrder[] = visibili.map((r) => ({
    id: r.id,
    status: r.status,
    bags: r.bags,
    created_at: r.created_at,
    eta_ready_at: r.eta_ready_at,
    courier_id: r.courier_id,
    laundry_id: r.laundry_id,
    customer_name: r.customer?.full_name ?? null,
    customer_phone: r.customer?.phone ?? null,
    zone_name: r.addresses?.zones?.name ?? null,
    laundry_name: r.laundries?.name ?? null,
    courier_name: r.courier?.full_name ?? null,
    pickup_at: r.pickup_slot?.starts_at ?? null,
    delivery_at: r.delivery_slot?.starts_at ?? null,
  }));

  const courierOpts: Opt[] = (couriers ?? []).map((c) => ({ id: c.id, name: c.full_name ?? c.id.slice(0, 6) }));

  // Ordini rimasti su una fascia tolta dal calendario.
  //
  // Archiviare una fascia occupata è permesso apposta — «le richieste dei
  // clienti restano anche se cancello tutto» — ma finora l'unico avviso era una
  // frase nel messaggio di conferma, che sparisce al primo clic. L'ordine
  // restava agganciato a un giorno che dal calendario non esiste più, in
  // prenotazione non compariva, e nei menù «sposta» nemmeno: immobile, e
  // silenzioso. È successo alla riconsegna di un cliente il 6 settembre.
  const daRisistemareRighe = visibili.filter((r) =>
    daRisistemare({
      aperto: ordineAperto(r.status),
      ritiroArchiviato: unoSolo(r.pickup_slot)?.archived_at != null,
      riconsegnaArchiviata: unoSolo(r.delivery_slot)?.archived_at != null,
    }),
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle kicker="Operations" title="Board ordini" sub={`${orders.length} ordini aperti · aggiornamento in tempo reale${includiProva ? " · inclusi i dati di prova" : ""}`} />
        <div className="mt-1 flex flex-wrap items-center gap-4">
          <Link href={includiProva ? "/admin/ordini" : "/admin/ordini?prova=1"} className="font-display text-sm font-bold text-navy/55 hover:text-navy">
            {includiProva ? "Nascondi dati di prova" : "Mostra dati di prova"}
          </Link>
          <Link href="/admin/ordini?stato=conclusi" className="font-display text-sm font-bold text-blue hover:underline">Ordini conclusi →</Link>
        </div>
      </div>
      {daRisistemareRighe.length > 0 && (
        <div className="mb-4 rounded-[16px] border-2 border-[#C9881F]/40 bg-[#C9881F]/[0.07] p-4">
          <span className="font-display text-base font-black text-[#C9881F]">
            Da risistemare: {daRisistemareRighe.length} {daRisistemareRighe.length === 1 ? "ordine" : "ordini"} su fasce tolte dal calendario
          </span>
          <p className="mt-1 text-sm font-medium text-navy/75">
            La fascia non c&apos;è più, ma l&apos;ordine ci sta ancora sopra: quel giorno non passa nessuno e
            il cliente non lo sa. Apri il ritiro e spostalo su una fascia viva.
          </p>
          <ul className="mt-3 space-y-1.5">
            {daRisistemareRighe.map((r) => {
              const rit = unoSolo(r.pickup_slot);
              const con = unoSolo(r.delivery_slot);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-white px-3 py-2">
                  <span className="font-display text-sm font-bold text-navy">
                    {r.customer?.full_name ?? "Cliente"}
                    <span className="ml-2 text-xs font-medium text-muted">
                      {rit?.archived_at ? `ritiro ${fmtFull(rit.starts_at)}` : ""}
                      {rit?.archived_at && con?.archived_at ? " · " : ""}
                      {con?.archived_at ? `riconsegna ${fmtFull(con.starts_at)}` : ""}
                    </span>
                  </span>
                  <Link href={`/admin/ordini/${r.id}`} className="font-display text-sm font-bold text-blue hover:underline">
                    Sposta →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {ok && <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}
      <OrdersBoard orders={orders} couriers={courierOpts} laundries={laundries ?? []} zones={zones ?? []} adesso={adessoDelRender()} filtroIniziale={filtro === "ritardo" || filtro === "da_assegnare" ? filtro : undefined} />
    </>
  );
}
