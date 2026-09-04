import { Card, PageTitle } from "@/components/app/AppShell";
import { createServiceClient } from "@/lib/supabase/server";
import { segnaMesePagato } from "@/lib/actions/payout";
import { BottoneInvio } from "@/components/ui/BottoneInvio";

export const dynamic = "force-dynamic";

type Riga = {
  id: string;
  laundry_id: string;
  order_id: string | null;
  kind: string;
  amount_cents: number;
  status: string;
  created_at: string;
  laundries: { name: string } | null;
};

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

const meseLabel = (chiave: string) => {
  const [a, m] = chiave.split("-");
  return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
};

/** Quanto dobbiamo alla lavanderia, per quali ordini e cosa abbiamo già pagato.
 *
 *  Prima il "Da dare" era un numero calcolato al volo sui sacchi degli ordini,
 *  con 8,00 € di ripiego: al momento del bonifico non si poteva giustificare
 *  ordine per ordine. Ora ogni consegna scrive la sua riga nel registro, e qui
 *  si vedono raggruppate per mese. */
export default async function LavanderiaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string }>;
}) {
  const { ok, warn } = await searchParams;
  const svc = createServiceClient();

  const { data } = await svc
    .from("laundry_payouts")
    .select("id, laundry_id, order_id, kind, amount_cents, status, created_at, laundries(name)")
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<Riga[]>();

  const righe = data ?? [];

  // Raggruppo per lavanderia e mese: è l'unità con cui si paga davvero.
  const gruppi = new Map<string, { lavanderia: string; laundryId: string; mese: string; sacchi: number; capi: number; totale: number; pagate: number; righe: number }>();
  for (const r of righe) {
    const mese = r.created_at.slice(0, 7);
    const chiave = `${r.laundry_id}|${mese}`;
    const g = gruppi.get(chiave) ?? {
      lavanderia: r.laundries?.name ?? "—",
      laundryId: r.laundry_id,
      mese,
      sacchi: 0,
      capi: 0,
      totale: 0,
      pagate: 0,
      righe: 0,
    };
    if (r.kind === "bag") g.sacchi += r.amount_cents;
    else g.capi += r.amount_cents;
    g.totale += r.amount_cents;
    g.righe += 1;
    if (r.status === "settled") g.pagate += r.amount_cents;
    gruppi.set(chiave, g);
  }

  const elenco = [...gruppi.values()].sort((a, b) => b.mese.localeCompare(a.mese));
  const daPagare = elenco.reduce((t, g) => t + (g.totale - g.pagate), 0);

  // Quello che maturerà quando il rider chiuderà i giri di oggi.
  //
  // Senza questo numero la pagina è vera e sembra sbagliata: il 4 settembre
  // diceva «11,89 € da pagare» — cioè i soli capi speciali — mentre in
  // lavanderia c'erano quattro sacchi lavati e pronti, per altri 32 €. Il
  // compenso a sacco si registra alla consegna, quindi prima non esiste; ma chi
  // guarda la cifra sta per fare un bonifico, e deve sapere che non è finita.
  const { data: inViaggio } = await svc
    .from("orders")
    .select("bags, laundry_id, laundries(bag_comp_cents)")
    .in("status", ["delivery_scheduled", "out_for_delivery"])
    .not("laundry_id", "is", null)
    .returns<{ bags: number | null; laundry_id: string; laundries: { bag_comp_cents: number | null } | { bag_comp_cents: number | null }[] | null }[]>();

  let sacchiDaMaturare = 0;
  let importoDaMaturare = 0;
  for (const o of inViaggio ?? []) {
    const rel = o.laundries;
    const lav = Array.isArray(rel) ? rel[0] : rel;
    const sacchi = o.bags ?? 1;
    sacchiDaMaturare += sacchi;
    importoDaMaturare += (lav?.bag_comp_cents ?? 800) * sacchi;
  }

  return (
    <>
      <PageTitle
        kicker="Finanza"
        title="Soldi alla lavanderia"
        sub="Compensi maturati per sacchi e capi speciali, raggruppati per mese. IVA esclusa."
      />

      {ok && <div className="mb-4 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] bg-[#C9881F]/12 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <Card className="mb-6">
        <h2 className="font-display text-base font-extrabold text-navy">
          {daPagare > 0 ? `${eur(daPagare)} ancora da pagare` : "Nessun importo in sospeso"}
        </h2>
        {importoDaMaturare > 0 && (
          <p className="mt-2 rounded-[12px] bg-[#C9881F]/10 px-3 py-2 text-sm font-semibold text-[#C9881F]">
            Più <strong>{eur(importoDaMaturare)}</strong> ancora da maturare su {sacchiDaMaturare}{" "}
            {sacchiDaMaturare === 1 ? "sacco lavato ma non ancora consegnato" : "sacchi lavati ma non ancora consegnati"}:
            entrano nel conto quando il rider chiude la consegna. Totale previsto{" "}
            <strong>{eur(daPagare + importoDaMaturare)}</strong>.
          </p>
        )}
        <p className="mt-1 text-sm font-medium text-muted">
          Il compenso per i sacchi matura alla consegna; quello dei capi speciali quando la lavanderia li aggiunge.
          Il compenso a sacco si imposta in Catalogo, sulla scheda della lavanderia.
        </p>
      </Card>

      {elenco.length === 0 ? (
        <Card>
          <p className="text-sm font-medium text-muted">
            Nessun compenso registrato. Le righe compaiono qui a partire dalla prima consegna.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {elenco.map((g) => {
            const residuo = g.totale - g.pagate;
            return (
              <Card key={`${g.laundryId}-${g.mese}`} className="!p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-sm font-extrabold text-navy">
                      {g.lavanderia} · {meseLabel(g.mese)}
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-muted">
                      {eur(g.sacchi)} sacchi + {eur(g.capi)} capi speciali · {g.righe} {g.righe === 1 ? "voce" : "voci"}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <div className="text-right">
                      <div className={`font-display text-lg font-black ${residuo > 0 ? "text-[#C9881F]" : "text-[#1F8A5B]"}`}>
                        {eur(residuo > 0 ? residuo : g.totale)}
                      </div>
                      <div className="text-[11px] font-semibold text-muted">{residuo > 0 ? "da pagare" : "pagato"}</div>
                    </div>
                    {residuo > 0 && (
                      <form action={segnaMesePagato}>
                        <input type="hidden" name="laundry_id" value={g.laundryId} />
                        <input type="hidden" name="mese" value={g.mese} />
                        <BottoneInvio className="rounded-full border-2 border-navy/20 px-4 py-2 font-display text-xs font-bold text-navy">
                          Segna pagato
                        </BottoneInvio>
                      </form>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
