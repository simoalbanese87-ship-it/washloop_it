"use client";

import { useState } from "react";
import { resetStaffPassword, deleteStaff, updateStaffEmail } from "@/lib/actions/staff";

/** Azioni per un membro staff: cambia email di accesso, reinvia credenziali,
 *  elimina (con conferma). Il cambio email serve a intestare a una persona vera
 *  un account nato come `*.test@` senza toccarne la password.
 *
 *  La conferma dell'eliminazione è in pagina e non un `confirm()` del browser:
 *  è la stessa forma usata nella scheda cliente, dice il nome di chi si sta
 *  cancellando invece di una finestrella grigia, e non blocca la pagina. */
export function StaffRowActions({ id, name, email }: { id: string; name: string; email?: string }) {
  const [apri, setApri] = useState(false);
  const [chiedo, setChiedo] = useState(false);

  if (apri) {
    return (
      <form action={updateStaffEmail} className="flex flex-none items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input
          type="email"
          name="email"
          required
          defaultValue={email ?? ""}
          placeholder="nuova@email.it"
          className="h-9 w-56 rounded-[10px] border border-line bg-ice px-3 text-[12px] font-medium text-navy outline-none focus:border-blue"
        />
        <button type="submit" className="font-display text-[11px] font-bold text-blue hover:underline">Salva</button>
        <button type="button" onClick={() => setApri(false)} className="font-display text-[11px] font-bold text-muted hover:underline">Annulla</button>
      </form>
    );
  }

  return (
    <div className="flex flex-none items-center gap-3">
      <button type="button" onClick={() => setApri(true)} className="font-display text-[11px] font-bold text-navy/70 hover:underline">
        Cambia email
      </button>
      <form action={resetStaffPassword}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="font-display text-[11px] font-bold text-blue hover:underline">Reinvia accesso</button>
      </form>
      {chiedo ? (
        <form action={deleteStaff} className="flex items-center gap-2 rounded-[10px] border border-[#C0392B]/25 px-2.5 py-1.5">
          <input type="hidden" name="id" value={id} />
          <span className="text-[11px] font-semibold text-navy">Elimini l&apos;accesso di {name}?</span>
          <button type="submit" className="rounded-full bg-[#C0392B] px-2.5 py-1 font-display text-[11px] font-extrabold text-white">
            Sì, elimina
          </button>
          <button type="button" onClick={() => setChiedo(false)} className="font-display text-[11px] font-bold text-muted hover:underline">
            No
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setChiedo(true)} className="font-display text-[11px] font-bold text-[#C0392B] hover:underline">
          Elimina
        </button>
      )}
    </div>
  );
}
