"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createPickup } from "@/lib/actions/orders";
import { fmtSlot } from "@/lib/format";

export type Address = { id: string; label: string | null; street: string; zone_id: string | null };
export type Laundry = { id: string; name: string; zone_id: string | null };
export type Slot = { id: string; starts_at: string; ends_at: string; laundry_id: string | null };

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";

export function PrenotaForm({ addresses, laundries, slots }: { addresses: Address[]; laundries: Laundry[]; slots: Slot[] }) {
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const address = addresses.find((a) => a.id === addressId);

  // Lavanderie attive nella zona dell'indirizzo scelto
  const zoneLaundries = useMemo(
    () => laundries.filter((l) => !address?.zone_id || l.zone_id === address.zone_id),
    [laundries, address?.zone_id],
  );

  // Routing interno: la lavanderia non è scelta né mostrata al cliente.
  // Usiamo la prima lavanderia attiva nella zona dell'indirizzo.
  const effectiveLaundryId = zoneLaundries[0]?.id ?? "";

  const laundrySlots = slots.filter((s) => s.laundry_id === effectiveLaundryId);

  const noLaundry = zoneLaundries.length === 0;

  return (
    <form action={createPickup} className="space-y-5">
      <input type="hidden" name="laundry_id" value={effectiveLaundryId} />

      <div>
        <label className="font-display text-sm font-extrabold text-navy">Indirizzo di ritiro</label>
        <select name="address_id" required value={addressId} onChange={(e) => setAddressId(e.target.value)} className={`${input} mt-2`}>
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label ? `${a.label} — ` : ""}
              {a.street}
            </option>
          ))}
        </select>
      </div>

      {noLaundry ? (
        <p className="rounded-[14px] bg-ice p-3 text-sm font-medium text-muted">
          Zona non ancora coperta. Stiamo arrivando — riprova presto.
        </p>
      ) : (
        <>
          <div>
            <label className="font-display text-sm font-extrabold text-navy">Fascia di ritiro</label>
            {laundrySlots.length === 0 ? (
              <p className="mt-2 rounded-[14px] bg-ice p-3 text-sm font-medium text-muted">
                Nessuno slot disponibile per questa lavanderia. Riprova più tardi.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {laundrySlots.map((s, i) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-ice px-4 py-3 has-[:checked]:border-blue has-[:checked]:bg-blue/5">
                    <input type="radio" name="pickup_slot_id" value={s.id} required defaultChecked={i === 0} className="accent-[#2b7fd4]" />
                    <span className="text-sm font-semibold text-navy">{fmtSlot(s.starts_at, s.ends_at)}</span>
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

          <Button type="submit" disabled={laundrySlots.length === 0} className="w-full sm:w-auto">
            Conferma ritiro →
          </Button>
        </>
      )}
    </form>
  );
}
