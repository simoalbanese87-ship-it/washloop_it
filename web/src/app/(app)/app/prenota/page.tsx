import Link from "next/link";
import { PrenotaForm, type Address, type Laundry, type Slot } from "@/components/app/PrenotaForm";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/auth";

export default async function PrenotaPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [active, { data: addresses }, { data: laundries }, { data: slots }] = await Promise.all([
    hasActiveSubscription(),
    supabase.from("addresses").select("id, label, street, zone_id").order("created_at", { ascending: false }).returns<Address[]>(),
    supabase.from("laundries").select("id, name, zone_id").eq("active", true).returns<Laundry[]>(),
    supabase.from("slots").select("id, starts_at, ends_at, laundry_id").eq("kind", "pickup").gte("starts_at", nowIso).order("starts_at").limit(40).returns<Slot[]>(),
  ]);

  const noAddress = !addresses || addresses.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Nuovo ritiro</div>
        <h1 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">Prenota un ritiro</h1>
        <p className="mt-1.5 text-sm font-medium text-muted">Scegli lavanderia, giorno e ora: al resto pensiamo noi.</p>
      </div>

      {!active ? (
        <section className="rounded-[18px] border border-line bg-white p-5">
          <h2 className="font-display text-lg font-black text-navy">Serve un abbonamento attivo</h2>
          <p className="mt-2 text-sm font-medium text-muted">
            La prenotazione dei ritiri è inclusa nell&apos;abbonamento WashLoop. Attiva un piano per iniziare: puoi metterlo in pausa o disdirlo quando vuoi.
          </p>
          <Link
            href="/app/abbonamento"
            className="mt-5 inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-6 py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]"
          >
            Vedi i piani →
          </Link>
        </section>
      ) : noAddress ? (
        <section className="rounded-[18px] border border-line bg-white p-5 text-sm font-medium text-muted">
          Prima aggiungi un indirizzo.{" "}
          <Link href="/app/indirizzi" className="font-bold text-blue hover:underline">Vai agli indirizzi →</Link>
        </section>
      ) : (
        <section className="rounded-[18px] border border-line bg-white p-5">
          <PrenotaForm addresses={addresses!} laundries={laundries ?? []} slots={slots ?? []} />
        </section>
      )}
    </div>
  );
}
