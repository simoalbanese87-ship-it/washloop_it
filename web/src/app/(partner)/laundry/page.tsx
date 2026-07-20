import { PageTitle } from "@/components/app/AppShell";
import { LaundryBoardDnD, type PartnerOrder } from "@/components/app/LaundryBoardDnD";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LaundryBoard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_orders")
    .select("order_id, client_code, bags, service, fragrance, status, eta_ready_at, created_at")
    .order("created_at", { ascending: true })
    .returns<(PartnerOrder & { created_at: string })[]>();

  const active = (data ?? []).filter((r) => ["picked_up", "at_laundry", "washing", "ready"].includes(r.status));

  return (
    <>
      <PageTitle
        kicker="Portale lavanderia"
        title="Lavorazioni"
        sub={`${active.length} ordini attivi · trascina le schede tra le colonne per aggiornare lo stato`}
      />

      <LaundryBoardDnD orders={active} />

      {active.length === 0 && (
        <p className="mt-8 text-center text-sm font-medium text-muted">
          Nessuna lavorazione in corso. Gli ordini compaiono qui quando il corriere li ritira.
        </p>
      )}
    </>
  );
}
