import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { RiderMapLoader } from "@/components/app/RiderMapLoader";
import type { Stop, Depot } from "@/components/app/RiderMap";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { passaggiDellOrdine, type Passaggio } from "@/lib/planning-rider";
import { primoGiornoDelGiro } from "@/lib/giro-del-giorno";
import { optimizeOrder, partenzaDelGiro } from "@/lib/route";
import { STATI_CHIUSI, type OrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Il planning del rider: cosa c'è da fare nei prossimi giorni.
 *
 *  Perché non basta «Oggi»
 *  -----------------------
 *  La pagina del giro mostra le fermate di oggi, ed è giusto: di fronte a una
 *  porta serve sapere la prossima, non la settimana. Ma per organizzarsi —
 *  quante ore prendere giovedì, se martedì si può fare altro — serve la vista
 *  lunga, e non c'era.
 *
 *  Le riconsegne previste
 *  ----------------------
 *  Un sacco ritirato martedì torna venerdì: 72 ore, il turnaround
 *  dell'abbonamento. Quella riga compare **subito**, il giorno del ritiro, senza
 *  aspettare che la lavanderia prema «pronto». Se aspettasse, metà settimana
 *  resterebbe vuota fino all'ultimo momento — e su un calendario vuoto non si
 *  pianifica niente.
 *
 *  Previsione e impegno restano distinti a vista: dove la fascia è stata
 *  concordata c'è l'ora, dove è calcolata c'è scritto «prevista». Confonderli
 *  vorrebbe dire far promettere al rider un orario che nessuno gli ha dato.
 *
 *  Il prossimo giro, in mappa
 *  --------------------------
 *  In cima c'è la giornata del prossimo ritiro — il martedì — disegnata come la
 *  pagina «Oggi» disegna la giornata in corso: fermate numerate nell'ordine in
 *  cui si guida, partenza dal deposito (o dalla lavanderia, se si apre con una
 *  riconsegna). Chiesto da Meryl il 6 ottobre 2026: l'elenco dice cosa c'è, la
 *  mappa dice come si organizza, e sono due domande diverse. */

type Riga = {
  id: string;
  status: OrderStatus;
  bags: number;
  eta_ready_at: string | null;
  customer: { full_name: string | null; client_code: string | null } | null;
  addresses: { street: string; lat: number | null; lng: number | null; zones: { name: string } | null } | null;
  pickup_slot: { starts_at: string; ends_at: string } | null;
  delivery_slot: { starts_at: string; ends_at: string } | null;
};

const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

const giornoDi = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const etichettaGiorno = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
const ora = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default async function PlanningRider({
  searchParams,
}: {
  searchParams: Promise<{ giorni?: string }>;
}) {
  const { giorni: g } = await searchParams;
  const giorni = Math.min(30, Math.max(3, parseInt(g ?? "7", 10) || 7));

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  // Il punto di partenza del giro, come in «Oggi»: il deposito è l'hub interno,
  // la lavanderia serve solo quando la giornata apre con una riconsegna.
  const [{ data: depotRow }, { data: lavRow }] = await Promise.all([
    supabase.from("depots").select("lat, lng").eq("active", true).limit(1).maybeSingle<{ lat: number | null; lng: number | null }>(),
    supabase.from("laundries").select("lat, lng").eq("active", true).not("lat", "is", null).limit(1).maybeSingle<{ lat: number | null; lng: number | null }>(),
  ]);

  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, bags, eta_ready_at, customer:profiles!orders_customer_id_fkey(full_name, client_code), addresses(street, lat, lng, zones(name)), pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)",
    )
    .eq("courier_id", profile?.id ?? "")
    .returns<Riga[]>();

  // Un solo istante letto, e da lì si deriva il resto: chiamare l'orologio più
  // volte dentro il render è quello che il linter segnala, giustamente.
  const adesso = new Date();
  // Due giorni indietro: una fermata saltata ieri va recuperata, non nascosta.
  const da = adesso.getTime() - 2 * 86_400_000;
  const a = adesso.getTime() + giorni * 86_400_000;

  type Voce = Passaggio & { riga: Riga };
  const voci: Voce[] = [];
  for (const r of data ?? []) {
    const ritiroFatto = r.status !== "pickup_scheduled" && r.status !== "requested";
    for (const p of passaggiDellOrdine({
      id: r.id,
      ritiroIso: uno(r.pickup_slot)?.starts_at ?? null,
      riconsegnaIso: uno(r.delivery_slot)?.starts_at ?? null,
      etaPronto: r.eta_ready_at,
      ritiroFatto,
      chiuso: STATI_CHIUSI.includes(r.status),
    })) {
      const t = Date.parse(p.quando);
      if (t >= da && t <= a) voci.push({ ...p, riga: r });
    }
  }
  voci.sort((x, y) => x.quando.localeCompare(y.quando));

  const perGiorno = new Map<string, Voce[]>();
  for (const v of voci) {
    const k = giornoDi(v.quando);
    (perGiorno.get(k) ?? perGiorno.set(k, []).get(k)!).push(v);
  }
  const oggi = giornoDi(adesso.toISOString());

  // ---- Il prossimo giro, in mappa ----------------------------------------
  // Si sceglie una giornata sola: la prima, da oggi in avanti, che ha un ritiro
  // con l'ora concordata. Poi si ordinano le sue fermate con la stessa macchina
  // della pagina «Oggi» — nessun criterio nuovo, o il rider si troverebbe due
  // percorsi diversi per lo stesso giro.
  const giornoGiro = primoGiornoDelGiro(
    voci.map((v) => ({ giorno: giornoDi(v.quando), tipo: v.tipo, confermato: v.confermato })),
    oggi,
  );
  // Solo le fermate con l'ora davvero fissata: una riconsegna «prevista» è una
  // stima a 72 ore, e un giro disegnato su una stima manda il rider a suonare a
  // un'ora che nessuno ha promesso.
  const fermate = giornoGiro
    ? voci.filter((v) => giornoDi(v.quando) === giornoGiro && v.confermato)
    : [];
  const conGeo = fermate.filter((v) => v.riga.addresses?.lat != null && v.riga.addresses?.lng != null);
  const senzaGeo = fermate.filter((v) => !(v.riga.addresses?.lat != null && v.riga.addresses?.lng != null));

  const depot: Depot = depotRow?.lat != null && depotRow?.lng != null ? { lat: depotRow.lat, lng: depotRow.lng } : null;
  const lavanderia: Depot = lavRow?.lat != null && lavRow?.lng != null ? { lat: lavRow.lat, lng: lavRow.lng } : null;
  const primaPerOrario = [...fermate].sort((a, b) => a.quando.localeCompare(b.quando))[0];
  const partenza = partenzaDelGiro(!!primaPerOrario && primaPerOrario.tipo === "riconsegna", lavanderia, depot);

  const ordine = optimizeOrder(
    partenza,
    conGeo.map((v) => ({ lat: v.riga.addresses!.lat!, lng: v.riga.addresses!.lng!, deadlineMs: Date.parse(v.quando) })),
  );
  const fermateOrdinate = ordine.map((i) => conGeo[i]);
  const stops: Stop[] = fermateOrdinate.map((v, i) => ({
    id: `${v.orderId}-${v.tipo}`,
    kind: v.tipo === "ritiro" ? "pickup" : "delivery",
    n: i + 1,
    lat: v.riga.addresses!.lat!,
    lng: v.riga.addresses!.lng!,
    name: v.riga.customer?.full_name ?? "Cliente",
    address: v.riga.addresses?.street ?? "—",
    when: ora(v.quando),
  }));
  const ritiriDelGiro = fermate.filter((v) => v.tipo === "ritiro").length;

  const nRitiri = voci.filter((v) => v.tipo === "ritiro").length;
  const nConsegne = voci.filter((v) => v.tipo === "riconsegna").length;
  const nPreviste = voci.filter((v) => !v.confermato).length;

  return (
    <>
      <PageTitle
        kicker="Planning"
        title="I prossimi giorni"
        sub={`${nRitiri} ${nRitiri === 1 ? "ritiro" : "ritiri"} · ${nConsegne} ${nConsegne === 1 ? "riconsegna" : "riconsegne"}${nPreviste > 0 ? ` · ${nPreviste} da confermare` : ""}`}
      />

      {giornoGiro && fermate.length > 0 && (
        <Card className="mb-6 overflow-hidden !p-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
            <h2 className="font-display text-base font-extrabold capitalize text-navy">
              {etichettaGiorno(fermate[0].quando)}
              {giornoGiro === oggi && <span className="ml-2 rounded-full bg-navy px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">oggi</span>}
            </h2>
            <span className="font-display text-xs font-bold text-muted">
              il prossimo giro · {ritiriDelGiro} {ritiriDelGiro === 1 ? "ritiro" : "ritiri"}
              {fermate.length > ritiriDelGiro ? ` · ${fermate.length - ritiriDelGiro} in riconsegna` : ""}
            </span>
          </div>

          {stops.length > 0 && (
            <div className="mt-3">
              <RiderMapLoader stops={stops} depot={partenza} />
            </div>
          )}

          <ol className="divide-y divide-line px-4 pb-4">
            {fermateOrdinate.map((v, i) => (
              <li key={`${v.orderId}-${v.tipo}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-navy font-display text-[11px] font-extrabold text-white">{i + 1}</span>
                <span className="font-display text-sm font-extrabold tabular-nums text-navy">{ora(v.quando)}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-wide ${
                    v.tipo === "ritiro" ? "bg-blue/10 text-blue" : "bg-[#1F8A5B]/12 text-[#1F8A5B]"
                  }`}
                >
                  {v.tipo}
                </span>
                <span className="font-display text-sm font-bold text-navy">{v.riga.customer?.full_name ?? "Cliente"}</span>
                <span className="text-sm font-medium text-muted">{v.riga.addresses?.street ?? "—"}</span>
              </li>
            ))}
            {/* Senza coordinate non si può disegnare, ma la fermata esiste lo
                stesso: nasconderla vorrebbe dire far saltare un cliente al
                rider perché il geocoder non ha trovato la via. */}
            {senzaGeo.map((v) => (
              <li key={`${v.orderId}-${v.tipo}-nogeo`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full border border-line font-display text-[11px] font-extrabold text-muted">?</span>
                <span className="font-display text-sm font-extrabold tabular-nums text-navy">{ora(v.quando)}</span>
                <span className="font-display text-sm font-bold text-navy">{v.riga.customer?.full_name ?? "Cliente"}</span>
                <span className="text-sm font-medium text-muted">{v.riga.addresses?.street ?? "—"}</span>
                <span className="rounded-full border border-[#C9881F]/35 px-2.5 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-wide text-[#C9881F]">
                  senza posizione
                </span>
              </li>
            ))}
          </ol>

          <p className="px-4 pb-4 text-xs font-medium text-muted">
            {partenza
              ? "Percorso calcolato partendo dal punto di partenza del giro e rientrando lì."
              : "Nessun punto di partenza impostato: l'ordine tiene conto solo degli orari e delle distanze fra le fermate."}
          </p>
        </Card>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[7, 14, 30].map((n) => (
          <Link
            key={n}
            href={`/courier/planning?giorni=${n}`}
            className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
              giorni === n ? "bg-navy text-white" : "border border-line bg-white text-navy"
            }`}
          >
            {n} giorni
          </Link>
        ))}
        <span className="text-sm font-medium text-muted">
          Le riconsegne <strong className="text-navy">previste</strong> sono calcolate sulle 72 ore dal
          ritiro: martedì per venerdì. Non aspettano la lavanderia.
        </span>
      </div>

      {perGiorno.size === 0 ? (
        <Card>
          <p className="text-sm font-medium text-muted">Niente in programma in questi giorni.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {[...perGiorno.entries()].map(([giorno, lista]) => {
            const ritiri = lista.filter((v) => v.tipo === "ritiro").length;
            const consegne = lista.length - ritiri;
            const arretrato = giorno < oggi;
            return (
              <Card key={giorno} className={arretrato ? "border-[#C9881F]/40 bg-[#C9881F]/5" : undefined}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                  <h2 className="font-display text-base font-extrabold capitalize text-navy">
                    {etichettaGiorno(lista[0].quando)}
                    {giorno === oggi && <span className="ml-2 rounded-full bg-navy px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">oggi</span>}
                    {arretrato && <span className="ml-2 font-display text-xs font-extrabold text-[#C9881F]">da recuperare</span>}
                  </h2>
                  <span className="font-display text-xs font-bold text-muted">
                    {ritiri} {ritiri === 1 ? "ritiro" : "ritiri"} · {consegne} {consegne === 1 ? "riconsegna" : "riconsegne"}
                  </span>
                </div>

                <div className="divide-y divide-line">
                  {lista.map((v) => {
                    const ritiro = v.tipo === "ritiro";
                    return (
                      <div key={`${v.orderId}-${v.tipo}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                        <span className={`font-display text-sm font-extrabold tabular-nums ${v.confermato ? "text-navy" : "text-muted"}`}>
                          {v.confermato ? ora(v.quando) : "—:—"}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-wide ${
                            ritiro ? "bg-blue/10 text-blue" : "bg-[#1F8A5B]/12 text-[#1F8A5B]"
                          }`}
                        >
                          {ritiro ? "ritiro" : "riconsegna"}
                        </span>
                        <span className="font-display text-sm font-bold text-navy">
                          {v.riga.customer?.full_name ?? "Cliente"}
                        </span>
                        <span className="text-sm font-medium text-muted">
                          {v.riga.bags} {v.riga.bags === 1 ? "sacco" : "sacchi"} · {v.riga.addresses?.zones?.name ?? "—"} ·{" "}
                          {v.riga.addresses?.street ?? "—"}
                        </span>
                        {!v.confermato && (
                          <span className="rounded-full border border-[#C9881F]/35 px-2.5 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-wide text-[#C9881F]">
                            prevista
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs font-medium text-muted">
        Una riconsegna «prevista» non ha ancora un orario concordato: serve a farti sapere che quel
        giorno ci sarà. L&apos;ora arriva quando viene fissata la fascia, e la trovi in{" "}
        <Link href="/courier" className="font-bold text-blue hover:underline">Oggi</Link>.
      </p>
    </>
  );
}
