"use client";

import { useState } from "react";
import { deleteCustomer } from "@/lib/actions/admin-customer";

/** Elimina definitivamente un lead con account.
 *
 *  La conferma è in pagina e non un `confirm()` del browser: dice il nome di
 *  chi si sta cancellando, sta dove si è premuto, e non blocca il resto della
 *  pagina mentre è aperta — è la stessa forma usata nella scheda cliente,
 *  nella lista abbonati e negli accessi staff.
 *
 *  `back` riporta dove si stava: senza, si finiva sempre in `/admin/abbonati`
 *  anche partendo dalla Home. Le guardie vere (abbonamento in corso, ordini
 *  aperti) restano lato server. */
export function DeleteUserButton({ id, name, back }: { id: string; name: string; back?: string }) {
  const [chiedo, setChiedo] = useState(false);

  if (!chiedo) {
    return (
      <button
        type="button"
        onClick={() => setChiedo(true)}
        className="font-display text-[11px] font-bold text-[#C0392B] hover:underline"
        title="Elimina definitivamente"
      >
        Elimina
      </button>
    );
  }

  return (
    <form action={deleteCustomer} className="flex flex-none items-center gap-2 rounded-[10px] border border-[#C0392B]/25 px-2.5 py-1.5">
      <input type="hidden" name="customer_id" value={id} />
      {back && <input type="hidden" name="back" value={back} />}
      <span className="whitespace-nowrap text-[11px] font-semibold text-navy">Cancellare {name}?</span>
      <button type="submit" className="rounded-full bg-[#C0392B] px-2.5 py-1 font-display text-[11px] font-extrabold text-white">
        Sì
      </button>
      <button type="button" onClick={() => setChiedo(false)} className="font-display text-[11px] font-bold text-muted hover:underline">
        No
      </button>
    </form>
  );
}
