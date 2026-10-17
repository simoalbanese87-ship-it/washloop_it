import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { BottoneInvio } from "@/components/ui/BottoneInvio";
import { createServiceClient } from "@/lib/supabase/server";
import { compitiDaFare, type CompitoDaFare } from "@/lib/compiti-sync";
import { segnaCompitoFattoDalPannello, annullaCompito, assegnaCompito } from "@/lib/actions/compiti";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Il materiale: chi aspetta di riceverlo, e chi deve restituirlo.
 *
 *  Due liste e non una: sono due mestieri diversi. La prima è un cliente che ha
 *  pagato e non può ancora usare il servizio — è urgente e si misura in giorni.
 *  La seconda è roba nostra in casa d'altri, che non scade ma non si recupera
 *  da sola.
 *
 *  I compiti nascono dai cambi di abbonamento (`compiti-sync.ts`) e li ripassa
 *  il cron ogni notte. Questa pagina serve a tre cose che un automatismo non
 *  può fare: assegnare chi non ha un rider, spuntare quello che è stato fatto
 *  fuori dall'app, e annullare quello che non serve più. */

type Chiuso = {
  id: string;
  tipo: string;
  stato: string;
  fatto_at: string | null;
  annullato_at: string | null;
  annullato_perche: string | null;
  customer: { full_name: string | null } | { full_name: string | null }[] | null;
};

const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function CompitiPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string }>;
}) {
  const { ok, warn } = await searchParams;
  const svc = createServiceClient();

  const [tutti, { data: riderRows }, { data: chiusiRows }] = await Promise.all([
    // Senza `soloVisibili`: qui si vuole vedere anche il rientro programmato di
    // chi ha disdetto ma è servito fino al rinnovo. Al rider no, a noi sì.
    compitiDaFare({}),
    svc.from("profiles").select("id, full_name").eq("role", "courier").order("full_name").returns<{ id: string; full_name: string | null }[]>(),
    svc
      .from("compiti")
      .select("id, tipo, stato, fatto_at, annullato_at, annullato_perche, customer:profiles!compiti_customer_id_fkey(full_name)")
      .neq("stato", "aperto")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Chiuso[]>(),
  ]);

  const rider = riderRows ?? [];
  const dotazioni = tutti.filter((c) => c.tipo === "dotazione");
  const rientri = tutti.filter((c) => c.tipo === "rientro");
  const senzaRider = tutti.filter((c) => !c.assegnatoA).length;
  const inRitardo = tutti.filter((c) => c.inRitardo).length;

  return (
    <>
      <PageTitle
        kicker="Operatività"
        title="Materiale: da portare e da recuperare"
        sub={`${dotazioni.length} da consegnare · ${rientri.length} da recuperare${inRitardo ? ` · ${inRitardo} in ritardo` : ""}${senzaRider ? ` · ${senzaRider} senza rider` : ""}`}
      />

      {ok && <div className="mb-4 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] bg-[#C9881F]/12 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <Card className="mb-4">
        <p className="text-sm font-medium text-muted">
          Questi compiti nascono da soli quando un abbonamento comincia o finisce, e il rider li vede nel suo giro.{" "}
          <strong className="text-navy">Un rientro programmato compare al rider solo dalla fine del servizio pagato</strong>: qui
          lo vedi prima, con la data. Chi mette in pausa non genera nessun rientro — il sacco gli serve ancora.
        </p>
      </Card>

      <Sezione
        titolo={`Da consegnare (${dotazioni.length})`}
        vuoto="Nessuno aspetta materiale: tutti i clienti attivi hanno cartellini e sacco."
        compiti={dotazioni}
        rider={rider}
      />

      <Sezione
        titolo={`Da recuperare (${rientri.length})`}
        vuoto="Niente in giro: nessun ex cliente ha roba nostra in casa."
        compiti={rientri}
        rider={rider}
      />

      {(chiusiRows?.length ?? 0) > 0 && (
        <Card>
          <h2 className="font-display text-sm font-extrabold text-navy">Ultimi chiusi</h2>
          <ul className="mt-3 space-y-2">
            {(chiusiRows ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/60 pb-2 text-sm last:border-0">
                <span className="font-semibold text-navy">
                  {uno(c.customer)?.full_name ?? "Cliente"} · {c.tipo === "dotazione" ? "consegna" : "recupero"}
                </span>
                <span className="text-[11px] font-medium text-muted">
                  {c.stato === "fatto"
                    ? `fatto${c.fatto_at ? ` il ${fmtDate(c.fatto_at)}` : ""}`
                    : `annullato${c.annullato_at ? ` il ${fmtDate(c.annullato_at)}` : ""}${c.annullato_perche ? ` — ${c.annullato_perche}` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Sezione({
  titolo,
  vuoto,
  compiti,
  rider,
}: {
  titolo: string;
  vuoto: string;
  compiti: CompitoDaFare[];
  rider: { id: string; full_name: string | null }[];
}) {
  return (
    <Card className="mb-4">
      <h2 className="font-display text-base font-extrabold text-navy">{titolo}</h2>
      {compiti.length === 0 ? (
        <p className="mt-2 text-sm font-medium text-muted">{vuoto}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {compiti.map((c) => (
            <li key={c.id} className="rounded-[14px] border border-line bg-ice px-3.5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/admin/abbonati/${c.clienteId}`} className="font-display text-sm font-extrabold text-navy hover:underline">
                  {c.cliente}
                  {c.clientCode ? <span className="ml-1.5 font-mono text-[11px] font-bold text-muted">{c.clientCode}</span> : null}
                </Link>
                {c.scadeIl && (
                  <span className={`text-[11px] font-bold ${c.inRitardo ? "text-[#C0392B]" : "text-muted"}`}>
                    {c.inRitardo ? "era per il " : "entro il "}
                    {c.scadeIl}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs font-medium text-muted">
                {c.indirizzo}
                {c.zona ? ` · ${c.zona}` : ""}
                {c.manca ? ` · ${c.tipo === "dotazione" ? "manca" : "ha"}: ${c.manca}` : ""}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <form action={assegnaCompito} className="flex items-center gap-1.5">
                  <input type="hidden" name="compito_id" value={c.id} />
                  <input type="hidden" name="back" value="/admin/compiti" />
                  <select
                    name="rider_id"
                    defaultValue={c.assegnatoA ?? ""}
                    className="h-9 rounded-[10px] border-2 border-line bg-white px-2 text-xs font-semibold text-navy"
                  >
                    <option value="">Senza rider</option>
                    {rider.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name ?? "Rider"}
                      </option>
                    ))}
                  </select>
                  <BottoneInvio
                    attesa="Salvo…"
                    className="rounded-full border-2 border-navy/20 px-3 py-1.5 font-display text-[11px] font-bold text-navy"
                  >
                    Assegna
                  </BottoneInvio>
                </form>

                <form action={segnaCompitoFattoDalPannello}>
                  <input type="hidden" name="compito_id" value={c.id} />
                  <input type="hidden" name="back" value="/admin/compiti" />
                  <input type="hidden" name="qty" value="2" />
                  <BottoneInvio
                    attesa="Salvo…"
                    className="rounded-full bg-gradient-to-br from-blue to-cyan px-3.5 py-1.5 font-display text-[11px] font-extrabold text-white"
                  >
                    {c.tipo === "dotazione" ? "Consegnato" : "Ripreso"}
                  </BottoneInvio>
                </form>

                <form action={annullaCompito}>
                  <input type="hidden" name="compito_id" value={c.id} />
                  <input type="hidden" name="back" value="/admin/compiti" />
                  <BottoneInvio
                    attesa="Annullo…"
                    className="rounded-full px-2.5 py-1.5 font-display text-[11px] font-bold text-muted hover:text-[#C0392B]"
                  >
                    Non serve
                  </BottoneInvio>
                </form>
              </div>

              {!c.assegnatoA && (
                <p className="mt-1.5 text-[11px] font-semibold text-[#C9881F]">
                  Nessun rider: non compare in nessun giro finché non lo assegni.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
