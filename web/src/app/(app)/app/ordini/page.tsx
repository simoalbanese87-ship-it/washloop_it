import { ListaPassaggi } from "@/components/app/ListaPassaggi";
import { createClient } from "@/lib/supabase/server";
import { dividiPassaggi, type OrdinePerPassaggi } from "@/lib/passaggi";

/** Ritiri e consegne: la lista dei passaggi, non degli ordini.
 *
 *  Ogni riga è un momento in cui ci vediamo — un ritiro o una riconsegna, con
 *  giorno e fascia. È il modo in cui la persona pensa al servizio: «lunedì
 *  passano a prendere, giovedì me lo riportano». L'indirizzo resta
 *  /app/ordini perché le email già inviate puntano lì. */
export default async function PassaggiPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("orders")
    .select(
      "id, status, created_at, bags, " +
        "pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at), " +
        "delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)",
    )
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        status: OrdinePerPassaggi["status"];
        created_at: string;
        bags: number;
        pickup_slot: { starts_at: string; ends_at: string } | null;
        delivery_slot: { starts_at: string; ends_at: string } | null;
      }[]
    >();

  const ordini: OrdinePerPassaggi[] = (rows ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    bags: r.bags,
    pickup_at: r.pickup_slot?.starts_at ?? null,
    pickup_end: r.pickup_slot?.ends_at ?? null,
    delivery_at: r.delivery_slot?.starts_at ?? null,
    delivery_end: r.delivery_slot?.ends_at ?? null,
  }));

  const { prossimi, passati } = dividiPassaggi(ordini);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-[23px] font-black tracking-[-0.03em] text-navy">Ritiri e consegne</h1>

      <section className="space-y-3">
        <h2 className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Prossimi</h2>
        <ListaPassaggi passaggi={prossimi} vuoto="Nessun passaggio in programma. Prenota un ritiro col tasto ➕." />
      </section>

      {passati.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Passati</h2>
          <ListaPassaggi passaggi={passati} vuoto="" />
        </section>
      )}
    </div>
  );
}
