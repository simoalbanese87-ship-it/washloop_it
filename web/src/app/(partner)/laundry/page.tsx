import { Card, PageTitle } from "@/components/app/AppShell";
import { LaundryBoardDnD, type PartnerOrder } from "@/components/app/LaundryBoardDnD";
import { createClient } from "@/lib/supabase/server";
import { segnaRestituito } from "@/lib/actions/partner";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LaundryBoard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_orders")
    .select("order_id, client_code, bags, service, fragrance, status, eta_ready_at, created_at")
    .order("created_at", { ascending: true })
    .returns<(PartnerOrder & { created_at: string })[]>();

  // `delivery_scheduled` compreso: il sacco è pronto e la riconsegna ha già
  // giorno e ora, ma finché il rider non passa resta fisicamente in lavanderia
  // e deve restare sul board (colonna «Pronti»).
  const active = (data ?? []).filter((r) => ["picked_up", "at_laundry", "washing", "ready", "delivery_scheduled"].includes(r.status));

  // Quali di questi ordini hanno già una segnalazione sui capi. Serve perché
  // chi guarda il tabellone deve sapere che su quel sacco c'è qualcosa di
  // scritto PRIMA di andarlo a cercare: senza, la segnalazione si scopre solo
  // aprendo l'ordine, cioè quasi mai.
  const { data: issues } = await supabase
    .from("order_issues")
    .select("order_id")
    .in("order_id", active.map((r) => r.order_id))
    .returns<{ order_id: string }[]>();
  const conteggio = new Map<string, number>();
  for (const i of issues ?? []) conteggio.set(i.order_id, (conteggio.get(i.order_id) ?? 0) + 1);
  const conSegnalazioni = active.map((r) => ({ ...r, segnalazioni: conteggio.get(r.order_id) ?? 0 }));

  // I capi rimasti qui. Questa è la parte che conta davvero: un capo trattenuto
  // e dimenticato è molto peggio di un capo consegnato macchiato, e nessuno se
  // ne ricorda guardando le colonne — perché quel capo non è più dentro nessun
  // sacco. Resta in cima al tabellone finché non viene restituito, anche
  // settimane dopo, anche quando l'ordine da cui viene è chiuso da un pezzo.
  const { data: trattenuti } = await supabase
    .from("order_issues")
    .select("id, order_id, capo, testo, created_at")
    .not("trattenuto_at", "is", null)
    .is("restituito_at", null)
    .order("created_at", { ascending: true })
    .returns<{ id: string; order_id: string; capo: string | null; testo: string; created_at: string }[]>();

  // Il codice cliente serve per sapere in quale sacco rimetterlo: la vista
  // `partner_orders` è l'unico posto da cui la lavanderia può leggerlo.
  const codicePerOrdine = new Map((data ?? []).map((r) => [r.order_id, r.client_code]));

  return (
    <>
      <PageTitle
        kicker="Portale lavanderia"
        title="Lavorazioni"
        sub={`${active.length} ordini attivi · trascina le schede tra le colonne per aggiornare lo stato`}
      />

      {(trattenuti ?? []).length > 0 && (
        <Card className="mb-6 !border-[#C9881F]/40 !bg-[#C9881F]/[0.06]">
          <h2 className="font-display text-lg font-extrabold text-[#C9881F]">
            Capi da restituire ({trattenuti!.length})
          </h2>
          <p className="mt-1 text-sm font-medium text-navy/70">
            Questi capi sono rimasti da voi. Vanno messi nel prossimo sacco dello stesso cliente. Restano qui
            finché non premete «Riportato».
          </p>
          <div className="mt-4 space-y-2">
            {trattenuti!.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-white px-3.5 py-2.5">
                <span className="rounded-full bg-ice px-2.5 py-1 font-display text-xs font-extrabold text-navy">
                  {codicePerOrdine.get(t.order_id) ?? "—"}
                </span>
                <span className="font-display text-sm font-extrabold text-navy">{t.capo || "Capo non indicato"}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{t.testo}</span>
                <span className="font-display text-xs font-bold text-muted">dal {fmtDate(t.created_at)}</span>
                <form action={segnaRestituito}>
                  <input type="hidden" name="issue_id" value={t.id} />
                  <input type="hidden" name="order_id" value={t.order_id} />
                  <button type="submit" className="font-display text-sm font-extrabold text-blue hover:underline">
                    Riportato
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LaundryBoardDnD orders={conSegnalazioni} />

      {active.length === 0 && (
        <p className="mt-8 text-center text-sm font-medium text-muted">
          Nessuna lavorazione in corso. Gli ordini compaiono qui quando il corriere li ritira.
        </p>
      )}
    </>
  );
}
