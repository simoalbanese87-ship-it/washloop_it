import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { PrenotaForm, type Address, type Laundry, type Slot } from "@/components/app/PrenotaForm";
import { createClient } from "@/lib/supabase/server";

export default async function PrenotaPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: addresses }, { data: laundries }, { data: slots }] = await Promise.all([
    supabase.from("addresses").select("id, label, street, zone_id").order("created_at", { ascending: false }).returns<Address[]>(),
    supabase.from("laundries").select("id, name, zone_id").eq("active", true).returns<Laundry[]>(),
    supabase.from("slots").select("id, starts_at, ends_at, laundry_id").eq("kind", "pickup").gte("starts_at", nowIso).order("starts_at").limit(40).returns<Slot[]>(),
  ]);

  const noAddress = !addresses || addresses.length === 0;

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
