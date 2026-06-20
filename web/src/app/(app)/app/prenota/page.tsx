import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { ButtonLink } from "@/components/ui/Button";
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

  if (!active) {
    return (
      <>
        <PageTitle kicker="Prenota" title="Prenota un ritiro" sub="Scegli lavanderia, giorno e ora: al resto pensiamo noi." />
        <Card className="max-w-2xl">
          <h2 className="font-display text-xl font-black text-navy">Serve un abbonamento attivo</h2>
          <p className="mt-2 text-sm font-medium text-muted">
            La prenotazione dei ritiri è inclusa nell'abbonamento WashLoop. Attiva un piano per iniziare: puoi metterlo in pausa o disdirlo quando vuoi.
          </p>
          <ButtonLink href="/app/abbonamento" size="md" className="mt-5">
            Vedi i piani →
          </ButtonLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle kicker="Prenota" title="Prenota un ritiro" sub="Scegli lavanderia, giorno e ora: al resto pensiamo noi." />

      {noAddress ? (
        <Card>
          <p className="text-sm font-medium text-muted">
            Prima aggiungi un indirizzo.{" "}
            <Link href="/app/indirizzi" className="font-bold text-blue hover:underline">
              Vai agli indirizzi →
            </Link>
          </p>
        </Card>
      ) : (
        <Card className="max-w-2xl">
          <PrenotaForm addresses={addresses!} laundries={laundries ?? []} slots={slots ?? []} />
        </Card>
      )}
    </>
  );
}
