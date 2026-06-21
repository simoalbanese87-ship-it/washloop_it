import Link from "next/link";
import { BookFlow, type Address, type Slot, type SpecialCategory } from "@/components/app/BookFlow";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/auth";

type Cat = { id: string; name: string; emoji: string; sort: number };
type Item = { category_id: string; name: string; price_cli_cents: number; sort: number };

export default async function PrenotaPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [active, { data: addresses }, { data: slots }, { data: cats }, { data: items }] = await Promise.all([
    hasActiveSubscription(),
    supabase.from("addresses").select("id, label, street, zone_id, access_mode, access_note").order("created_at", { ascending: false }).returns<Address[]>(),
    supabase.from("slots").select("id, starts_at, ends_at, laundry_id").eq("kind", "pickup").gte("starts_at", nowIso).order("starts_at").limit(80).returns<Slot[]>(),
    supabase.from("special_categories").select("id, name, emoji, sort").order("sort").returns<Cat[]>(),
    supabase.from("special_items").select("category_id, name, price_cli_cents, sort").eq("active", true).order("sort").returns<Item[]>(),
  ]);

  const categories: SpecialCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    items: (items ?? []).filter((i) => i.category_id === c.id).map((i) => ({ name: i.name, price_cli_cents: i.price_cli_cents })),
  })).filter((c) => c.items.length > 0);

  const noAddress = !addresses || addresses.length === 0;

  return (
    <div className="space-y-4">
      {!active ? (
        <>
          <div>
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Nuovo ritiro</div>
            <h1 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">Prenota un ritiro</h1>
          </div>
          <section className="rounded-[18px] border border-line bg-white p-5">
            <h2 className="font-display text-lg font-black text-navy">Serve un abbonamento attivo</h2>
            <p className="mt-2 text-sm font-medium text-muted">
              La prenotazione dei ritiri è inclusa nell&apos;abbonamento WashLoop. Attiva un piano per iniziare: puoi metterlo in pausa o disdirlo quando vuoi.
            </p>
            <Link href="/app/abbonamento" className="mt-5 inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-6 py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
              Vedi i piani →
            </Link>
          </section>
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
        <BookFlow addresses={addresses!} slots={slots ?? []} categories={categories} />
      )}
    </div>
  );
}
