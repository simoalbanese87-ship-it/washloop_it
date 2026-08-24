import Link from "next/link";
import { BookFlow, type Address, type Slot, type SpecialCategory } from "@/components/app/BookFlow";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/auth";
import { pickupCounts, deliveryCounts } from "@/lib/slots";

type Cat = { id: string; name: string; emoji: string; sort: number };
type Item = { category_id: string; name: string; price_cli_cents: number; sort: number };
type RawSlot = { id: string; starts_at: string; ends_at: string; laundry_id: string | null; capacity: number | null };

export default async function PrenotaPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [active, { data: sub }, { data: addresses }, { data: rawSlots }, { data: rawDelivery }, { data: cats }, { data: items }] = await Promise.all([
    hasActiveSubscription(),
    // `turnaround_hours` serve a sapere da quando in poi il bucato può tornare:
    // le fasce di riconsegna prima di quel momento non hanno senso mostrarle.
    supabase.from("subscriptions").select("status, plans(turnaround_hours)").order("created_at", { ascending: false }).limit(1).maybeSingle<{ status: string; plans: { turnaround_hours: number } | null }>(),
    supabase.from("addresses").select("id, label, street, zone_id, access_mode, access_note").order("created_at", { ascending: false }).returns<Address[]>(),
    supabase.from("slots").select("id, starts_at, ends_at, laundry_id, capacity").eq("kind", "pickup").gte("starts_at", nowIso).order("starts_at").limit(80).returns<RawSlot[]>(),
    supabase.from("slots").select("id, starts_at, ends_at, laundry_id, capacity").eq("kind", "delivery").gte("starts_at", nowIso).order("starts_at").limit(120).returns<RawSlot[]>(),
    supabase.from("special_categories").select("id, name, emoji, sort").order("sort").returns<Cat[]>(),
    // Vista e non tabella: `special_items` contiene anche il compenso pagato
    // alla lavanderia, che al cliente non deve arrivare nemmeno via API.
    supabase.from("special_items_public").select("category_id, name, price_cli_cents, sort").order("sort").returns<Item[]>(),
  ]);

  // Posti residui per slot (capacità − ordini non annullati già agganciati).
  const [counts, dCounts] = await Promise.all([
    pickupCounts(supabase, (rawSlots ?? []).map((s) => s.id)),
    deliveryCounts(supabase, (rawDelivery ?? []).map((s) => s.id)),
  ]);
  const residuo = (s: RawSlot, m: Map<string, number>) =>
    s.capacity == null ? null : Math.max(0, s.capacity - (m.get(s.id) ?? 0));
  const slots: Slot[] = (rawSlots ?? []).map((s) => ({
    id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, laundry_id: s.laundry_id, remaining: residuo(s, counts),
  }));
  const deliverySlots: Slot[] = (rawDelivery ?? []).map((s) => ({
    id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, laundry_id: s.laundry_id, remaining: residuo(s, dCounts),
  }));
  const turnaroundHours = sub?.plans?.turnaround_hours ?? 48;

  const categories: SpecialCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    items: (items ?? []).filter((i) => i.category_id === c.id).map((i) => ({ name: i.name, price_cli_cents: i.price_cli_cents })),
  })).filter((c) => c.items.length > 0);

  const noAddress = !addresses || addresses.length === 0;
  const sofferenza = sub?.status === "past_due" || sub?.status === "unpaid";

  return (
    <div className="space-y-4">
      {!active ? (
        <>
          <div>
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Nuovo ritiro</div>
            <h1 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">Prenota un ritiro</h1>
          </div>
          {/* Chi ha una fattura aperta non è un nuovo utente: dirgli «attiva un
              piano» quando paga da mesi è il modo più veloce per farlo scrivere
              all'assistenza. */}
          {sofferenza ? (
            <section className="rounded-[18px] border border-[#C0392B]/30 bg-[#C0392B]/5 p-5">
              <h2 className="font-display text-lg font-black text-navy">Pagamento non riuscito</h2>
              <p className="mt-2 text-sm font-medium text-muted">
                L&apos;ultimo addebito non è andato a buon fine, quindi i nuovi ritiri sono in pausa. Quelli già fissati li facciamo
                comunque. Salda la fattura aperta e torni a prenotare subito.
              </p>
              <Link href="/app/abbonamento" className="mt-5 inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-6 py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
                Sistema il pagamento →
              </Link>
            </section>
          ) : (
            <section className="rounded-[18px] border border-line bg-white p-5">
              <h2 className="font-display text-lg font-black text-navy">Serve un abbonamento attivo</h2>
              <p className="mt-2 text-sm font-medium text-muted">
                La prenotazione dei ritiri è inclusa nell&apos;abbonamento WashLoop. Attiva un piano per iniziare: puoi metterlo in pausa o disdirlo quando vuoi.
              </p>
              <Link href="/app/abbonamento" className="mt-5 inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-6 py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
                Vedi i piani →
              </Link>
            </section>
          )}
        </>
      ) : noAddress ? (
        <>
          <div>
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Nuovo ritiro</div>
            <h1 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">Prenota un ritiro</h1>
          </div>
          <section className="rounded-[18px] border border-line bg-white p-5 text-sm font-medium text-muted">
            Prima aggiungi un indirizzo.{" "}
            <Link href="/app/indirizzi" className="font-bold text-blue hover:underline">Vai agli indirizzi →</Link>
          </section>
        </>
      ) : (
        <BookFlow addresses={addresses!} slots={slots ?? []} deliverySlots={deliverySlots} turnaroundHours={turnaroundHours} categories={categories} />
      )}
    </div>
  );
}
