"use client";

import { useState } from "react";
import { addAddress } from "@/lib/actions/addresses";
import { ACCESS_MODE_LABEL } from "@/lib/orders";

const input = "h-12 w-full rounded-[16px] border-2 border-line bg-white px-4 text-sm font-semibold text-navy outline-none focus:border-cyan";

/** Form "Nuovo indirizzo" (cliente). Niente selezione zona (serviamo Milano).
 *  Il campo "Orario portineria" appare solo se modalità = Portineria. */
export function AddressForm() {
  const [accessMode, setAccessMode] = useState<"door" | "home" | "concierge">("door");

  return (
    <form action={addAddress} className="mt-4 space-y-3">
      <input name="label" placeholder="Etichetta (es. Casa)" className={input} />
      <input name="street" required placeholder="Via e numero civico" className={input} />
      <input name="city" defaultValue="Milano" placeholder="Città" className={input} />
      <div className="flex gap-3">
        <input name="floor" placeholder="Piano" className={input} />
        <input name="intercom" placeholder="Citofono" className={input} />
      </div>
      <select name="access_mode" value={accessMode} onChange={(e) => setAccessMode(e.target.value as typeof accessMode)} className={input}>
        <option value="door">{ACCESS_MODE_LABEL.door}</option>
        <option value="home">{ACCESS_MODE_LABEL.home}</option>
        <option value="concierge">{ACCESS_MODE_LABEL.concierge}</option>
      </select>
      {accessMode === "concierge" && (
        <>
          <input name="access_note" placeholder="Nome del portinaio (facoltativo)" className={input} />
          <input name="concierge_hours" placeholder="Orario portineria (facoltativo)" className={input} />
        </>
      )}
      <input name="notes" placeholder="Note per il corriere" className={input} />
      <button type="submit" className="w-full rounded-full bg-gradient-to-br from-blue to-cyan py-3.5 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
        Salva indirizzo
      </button>
    </form>
  );
}
