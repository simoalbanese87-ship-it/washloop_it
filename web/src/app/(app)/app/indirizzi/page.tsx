import { createClient } from "@/lib/supabase/server";
import { addAddress, deleteAddress } from "@/lib/actions/addresses";
import { ACCESS_MODE_LABEL, type AccessMode } from "@/lib/orders";

type Address = { id: string; label: string | null; street: string; intercom: string | null; floor: string | null; access_mode: AccessMode | null; access_note: string | null; zones: { name: string } | null };
type Zone = { id: string; name: string };

const input = "h-12 w-full rounded-[16px] border-2 border-line bg-white px-4 text-sm font-semibold text-navy outline-none focus:border-cyan";

const PinIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
);

export default async function IndirizziPage() {
  const supabase = await createClient();
  const [{ data: addresses }, { data: zones }] = await Promise.all([
    supabase.from("addresses").select("id, label, street, intercom, floor, access_mode, access_note, zones(name)").order("created_at", { ascending: false }).returns<Address[]>(),
    supabase.from("zones").select("id, name").eq("active", true).order("name").returns<Zone[]>(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Indirizzi</div>
        <h1 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">I tuoi indirizzi</h1>
        <p className="mt-1.5 text-sm font-medium text-muted">Dove ritiriamo e consegniamo i tuoi capi.</p>
      </div>

      {/* Lista indirizzi */}
      <div className="space-y-3">
        {addresses && addresses.length > 0 ? (
          addresses.map((a) => (
            <section key={a.id} className="flex items-start gap-3 rounded-[18px] border border-line bg-white p-4">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-ice text-blue"><PinIcon /></span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-extrabold text-navy">
                  {a.label ?? "Indirizzo"} {a.zones?.name && <span className="font-bold text-muted">· {a.zones.name}</span>}
                </div>
                <div className="mt-0.5 text-sm font-medium text-muted">{a.street}</div>
                {(a.intercom || a.floor) && (
                  <div className="mt-0.5 text-xs font-medium text-muted">
                    {a.floor && `Piano ${a.floor}`} {a.intercom && `· Citofono ${a.intercom}`}
                  </div>
                )}
                <div className="mt-1 inline-flex rounded-full bg-ice px-2.5 py-0.5 font-display text-[11px] font-extrabold text-blue">
                  {ACCESS_MODE_LABEL[(a.access_mode ?? "door") as AccessMode]}{a.access_note ? ` · ${a.access_note}` : ""}
                </div>
              </div>
              <form action={deleteAddress}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="font-display text-xs font-bold text-[#C0392B] hover:underline">Elimina</button>
              </form>
            </section>
          ))
        ) : (
          <div className="rounded-[18px] border border-line bg-white p-5 text-sm font-medium text-muted">
            Nessun indirizzo. Aggiungine uno per prenotare il ritiro.
          </div>
        )}
      </div>

      {/* Nuovo indirizzo */}
      <section className="rounded-[18px] border border-line bg-white p-5">
        <h2 className="font-display text-base font-extrabold text-navy">Nuovo indirizzo</h2>
        <form action={addAddress} className="mt-4 space-y-3">
          <input name="label" placeholder="Etichetta (es. Casa)" className={input} />
          <input name="street" required placeholder="Via e numero civico" className={input} />
          <select name="zone_id" className={input} defaultValue="">
            <option value="" disabled>Zona…</option>
            {(zones ?? []).map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
          <div className="flex gap-3">
            <input name="floor" placeholder="Piano" className={input} />
            <input name="intercom" placeholder="Citofono" className={input} />
          </div>
          <select name="access_mode" defaultValue="door" className={input}>
            <option value="door">{ACCESS_MODE_LABEL.door}</option>
            <option value="home">{ACCESS_MODE_LABEL.home}</option>
            <option value="concierge">{ACCESS_MODE_LABEL.concierge}</option>
          </select>
          <input name="access_note" placeholder="Dettaglio accesso (es. nome portinaio)" className={input} />
          <input name="notes" placeholder="Note per il corriere" className={input} />
          <button type="submit" className="w-full rounded-full bg-gradient-to-br from-blue to-cyan py-3.5 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
            Salva indirizzo
          </button>
        </form>
      </section>
    </div>
  );
}
