import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { createPickup } from "@/lib/actions/orders";

type Address = { id: string; label: string | null; street: string };
type Slot = { id: string; starts_at: string; ends_at: string; zones: { name: string } | null };

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";

function fmtSlot(s: Slot) {
  const d = new Date(s.starts_at);
  const e = new Date(s.ends_at);
  const day = d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
  const from = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const to = e.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${from}–${to}${s.zones?.name ? ` · ${s.zones.name}` : ""}`;
}

export default async function PrenotaPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: addresses }, { data: slots }] = await Promise.all([
    supabase.from("addresses").select("id, label, street").order("created_at", { ascending: false }).returns<Address[]>(),
    supabase.from("slots").select("id, starts_at, ends_at, zones(name)").eq("kind", "pickup").gte("starts_at", nowIso).order("starts_at").limit(20).returns<Slot[]>(),
  ]);

  const noAddress = !addresses || addresses.length === 0;
  const noSlots = !slots || slots.length === 0;

  return (
    <>
      <PageTitle kicker="Prenota" title="Prenota un ritiro" sub="Scegli dove e quando: passiamo noi." />

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
          <form action={createPickup} className="space-y-5">
            <div>
              <label className="font-display text-sm font-extrabold text-navy">Indirizzo di ritiro</label>
              <select name="address_id" required className={`${input} mt-2`} defaultValue="">
                <option value="" disabled>
                  Scegli…
                </option>
                {addresses!.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label ? `${a.label} — ` : ""}
                    {a.street}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-display text-sm font-extrabold text-navy">Fascia di ritiro</label>
              {noSlots ? (
                <p className="mt-2 rounded-[14px] bg-ice p-3 text-sm font-medium text-muted">
                  Nessuno slot disponibile al momento. Gli slot vengono creati dall&apos;area ops.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {slots!.map((s, i) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-ice px-4 py-3 has-[:checked]:border-blue has-[:checked]:bg-blue/5">
                      <input type="radio" name="pickup_slot_id" value={s.id} required defaultChecked={i === 0} className="accent-[#2b7fd4]" />
                      <span className="text-sm font-semibold text-navy">{fmtSlot(s)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="font-display text-sm font-extrabold text-navy">Quante buste?</label>
              <input name="bags" type="number" min={1} defaultValue={1} className={`${input} mt-2 max-w-28`} />
            </div>

            <input name="notes" placeholder="Note (facoltative)" className={input} />

            <Button type="submit" disabled={noSlots} className="w-full sm:w-auto">
              Conferma ritiro →
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}
