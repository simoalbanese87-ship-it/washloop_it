import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { addAddress, deleteAddress } from "@/lib/actions/addresses";

type Address = { id: string; label: string | null; street: string; intercom: string | null; floor: string | null; zones: { name: string } | null };
type Zone = { id: string; name: string };

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";

export default async function IndirizziPage() {
  const supabase = await createClient();
  const [{ data: addresses }, { data: zones }] = await Promise.all([
    supabase.from("addresses").select("id, label, street, intercom, floor, zones(name)").order("created_at", { ascending: false }).returns<Address[]>(),
    supabase.from("zones").select("id, name").eq("active", true).order("name").returns<Zone[]>(),
  ]);

  return (
    <>
      <PageTitle kicker="Indirizzi" title="I tuoi indirizzi" sub="Dove ritiriamo e consegniamo i tuoi capi." />

      <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          {addresses && addresses.length > 0 ? (
            addresses.map((a) => (
              <Card key={a.id} className="flex items-start justify-between">
                <div>
                  <div className="font-display text-sm font-extrabold text-navy">
                    {a.label ?? "Indirizzo"} {a.zones?.name && <span className="text-muted">· {a.zones.name}</span>}
                  </div>
                  <div className="mt-1 text-sm font-medium text-muted">{a.street}</div>
                  {(a.intercom || a.floor) && (
                    <div className="mt-0.5 text-xs font-medium text-muted">
                      {a.floor && `Piano ${a.floor}`} {a.intercom && `· Citofono ${a.intercom}`}
                    </div>
                  )}
                </div>
                <form action={deleteAddress}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="font-display text-xs font-bold text-[#C0392B] hover:underline">
                    Elimina
                  </button>
                </form>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm font-medium text-muted">Nessun indirizzo. Aggiungine uno per prenotare il ritiro.</p>
            </Card>
          )}
        </div>

        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Nuovo indirizzo</h2>
          <form action={addAddress} className="mt-4 space-y-3">
            <input name="label" placeholder="Etichetta (es. Casa)" className={input} />
            <input name="street" required placeholder="Via e numero civico" className={input} />
            <select name="zone_id" className={input} defaultValue="">
              <option value="" disabled>
                Zona…
              </option>
              {(zones ?? []).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <input name="floor" placeholder="Piano" className={input} />
              <input name="intercom" placeholder="Citofono" className={input} />
            </div>
            <input name="notes" placeholder="Note per il corriere" className={input} />
            <Button type="submit" size="md" className="w-full">
              Salva indirizzo
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
