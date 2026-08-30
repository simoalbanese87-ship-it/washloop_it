import Link from "next/link";
import { PageTitle } from "@/components/app/AppShell";
import { createServiceClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABEL, ordineAperto, type OrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Passaggio = {
  id: string;
  status: OrderStatus;
  bags: number;
  customer: { full_name: string | null; phone: string | null } | null;
  courier: { full_name: string | null } | null;
  addresses: { street: string; zones: { name: string } | null } | null;
  pickup_slot: { starts_at: string; ends_at: string } | null;
  delivery_slot: { starts_at: string; ends_at: string } | null;
};

/** Il calendario dei passaggi: chi si va a trovare, quando, e chi ci va.
 *
 *  Non esisteva. Il board ordini è organizzato per stato — «da ritirare», «in
 *  lavorazione» — e risponde alla domanda «a che punto è questo sacco». Ma la
 *  domanda di chi organizza le giornate è un'altra: «martedì mattina cosa c'è
 *  da fare, e chi lo fa». Per rispondere bisognava aprire gli ordini uno per
 *  uno e ricostruire le date a mente.
 *
 *  Un ordine compare due volte, ed è giusto: il ritiro è un passaggio, la
 *  riconsegna è un altro, spesso in giorni diversi e magari con rider diversi.
 *  Qui contano i giri, non le pratiche.
 *
 *  `?giorni=` allunga la finestra (14 di default, massimo 60). */
export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ giorni?: string; prova?: string }>;
}) {
  const { giorni: giorniRaw, prova } = await searchParams;
  const giorni = Math.min(60, Math.max(3, parseInt(giorniRaw ?? "14", 10) || 14));
  const includiProva = prova === "1";

  const svc = createServiceClient();
  const daIso = new Date(Date.now() - 2 * 86_400_000).toISOString(); // due giorni indietro: gli arretrati vanno visti
  const aIso = new Date(Date.now() + giorni * 86_400_000).toISOString();

  const { data: righe } = await svc
    .from("orders")
    .select(
      "id, status, bags, is_test:profiles!orders_customer_id_fkey(is_test), customer:profiles!orders_customer_id_fkey(full_name, phone), courier:profiles!orders_courier_id_fkey(full_name), addresses(street, zones(name)), pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)",
    )
    .returns<(Passaggio & { is_test: { is_test: boolean } | null })[]>();

  // Un ordine genera fino a due righe: il ritiro e la riconsegna.
  type Riga = {
    orderId: string;
    tipo: "ritiro" | "riconsegna";
    quando: string;
    fine: string | null;
    status: OrderStatus;
    bags: number;
    cliente: string;
    telefono: string | null;
    rider: string | null;
    zona: string | null;
    via: string | null;
  };

  const righeCalendario: Riga[] = [];
  for (const o of righe ?? []) {
    if (!includiProva && o.is_test?.is_test) continue;
    if (!ordineAperto(o.status)) continue;
    const base = {
      orderId: o.id,
      status: o.status,
      bags: o.bags,
      cliente: o.customer?.full_name ?? "—",
      telefono: o.customer?.phone ?? null,
      rider: o.courier?.full_name ?? null,
      zona: o.addresses?.zones?.name ?? null,
      via: o.addresses?.street ?? null,
    };
    if (o.pickup_slot?.starts_at && o.pickup_slot.starts_at >= daIso && o.pickup_slot.starts_at <= aIso) {
      righeCalendario.push({ ...base, tipo: "ritiro", quando: o.pickup_slot.starts_at, fine: o.pickup_slot.ends_at });
    }
    if (o.delivery_slot?.starts_at && o.delivery_slot.starts_at >= daIso && o.delivery_slot.starts_at <= aIso) {
      righeCalendario.push({ ...base, tipo: "riconsegna", quando: o.delivery_slot.starts_at, fine: o.delivery_slot.ends_at });
    }
  }
  righeCalendario.sort((a, b) => a.quando.localeCompare(b.quando));

  const giornoDi = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const etichettaGiorno = (iso: string) =>
    new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
  const ora = (iso: string) =>
    new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const perGiorno = new Map<string, Riga[]>();
  for (const r of righeCalendario) {
    const k = giornoDi(r.quando);
    (perGiorno.get(k) ?? perGiorno.set(k, []).get(k)!).push(r);
  }
  const oggi = giornoDi(new Date().toISOString());

  return (
    <>
      <PageTitle
        kicker="Operations"
        title="Calendario passaggi"
        sub="Cosa c'è da fare giorno per giorno: ritiri e riconsegne, con il rider assegnato."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[7, 14, 30].map((g) => (
          <Link
            key={g}
            href={`/admin/calendario?giorni=${g}${includiProva ? "&prova=1" : ""}`}
            className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
              giorni === g ? "bg-navy text-white" : "border border-line bg-white text-navy"
            }`}
          >
            {g} giorni
          </Link>
        ))}
        <span className="text-sm font-medium text-muted">
          {righeCalendario.length} {righeCalendario.length === 1 ? "passaggio" : "passaggi"} · due giorni indietro
          inclusi, così gli arretrati non spariscono
        </span>
        <Link
          href={includiProva ? `/admin/calendario?giorni=${giorni}` : `/admin/calendario?giorni=${giorni}&prova=1`}
          className="ml-auto font-display text-xs font-bold text-muted hover:text-navy"
        >
          {includiProva ? "← Nascondi i dati di prova" : "Mostra anche i dati di prova →"}
        </Link>
      </div>

      {perGiorno.size === 0 ? (
        <div className="rounded-[20px] border border-line bg-white p-6 text-sm font-medium text-muted">
          Nessun passaggio in programma in questa finestra.
        </div>
      ) : (
        <div className="space-y-5">
          {[...perGiorno.entries()].map(([giorno, lista]) => {
            const ritiri = lista.filter((r) => r.tipo === "ritiro").length;
            const senzaRider = lista.filter((r) => !r.rider).length;
            const passato = giorno < oggi;
            return (
              <section
                key={giorno}
                className={`overflow-hidden rounded-[20px] border bg-white ${
                  giorno === oggi ? "border-blue/40 shadow-[0_10px_30px_-24px_rgba(27,45,94,0.6)]" : "border-line"
                }`}
              >
                <div className={`flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 ${giorno === oggi ? "bg-blue/8" : "bg-ice"}`}>
                  <h2 className="font-display text-sm font-extrabold capitalize text-navy">
                    {etichettaGiorno(lista[0].quando)}
                    {giorno === oggi && <span className="ml-2 rounded-full bg-blue px-2 py-0.5 text-[10px] font-black uppercase text-white">oggi</span>}
                    {passato && <span className="ml-2 rounded-full bg-[#C9881F]/15 px-2 py-0.5 text-[10px] font-black uppercase text-[#C9881F]">da chiudere</span>}
                  </h2>
                  <span className="text-xs font-semibold text-muted">
                    {ritiri} {ritiri === 1 ? "ritiro" : "ritiri"} · {lista.length - ritiri}{" "}
                    {lista.length - ritiri === 1 ? "riconsegna" : "riconsegne"}
                    {senzaRider > 0 && <span className="text-[#C0392B]"> · {senzaRider} senza rider</span>}
                  </span>
                </div>

                <div className="divide-y divide-line">
                  {lista.map((r) => (
                    <Link
                      key={`${r.orderId}-${r.tipo}`}
                      href={`/admin/ordini/${r.orderId}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-ice"
                    >
                      <span className="font-mono text-sm font-bold text-navy">{ora(r.quando)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wide ${
                          r.tipo === "ritiro" ? "bg-blue/12 text-blue" : "bg-[#1F8A5B]/12 text-[#1F8A5B]"
                        }`}
                      >
                        {r.tipo}
                      </span>
                      <span className="font-display text-sm font-bold text-navy">{r.cliente}</span>
                      <span className="text-xs font-medium text-muted">
                        {r.bags} {r.bags === 1 ? "sacco" : "sacchi"}
                        {r.zona ? ` · ${r.zona}` : ""}
                        {r.via ? ` · ${r.via}` : ""}
                      </span>
                      <span className="ml-auto flex items-center gap-3">
                        {r.telefono && <span className="font-mono text-xs font-semibold text-muted">{r.telefono}</span>}
                        <span className={`font-display text-xs font-bold ${r.rider ? "text-navy" : "text-[#C0392B]"}`}>
                          {r.rider ?? "senza rider"}
                        </span>
                        <span className="font-display text-[11px] font-bold text-muted">{ORDER_STATUS_LABEL[r.status]}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
