"use client";

import { useState } from "react";
import { resetStaffPassword, deleteStaff, updateStaffEmail } from "@/lib/actions/staff";

/** Azioni per un membro staff: cambia email di accesso, reinvia credenziali,
 *  elimina (con conferma). Il cambio email serve a intestare a una persona vera
 *  un account nato come `*.test@` senza toccarne la password. */
export function StaffRowActions({ id, name, email }: { id: string; name: string; email?: string }) {
  const [apri, setApri] = useState(false);

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
      <form action={deleteStaff} onSubmit={(e) => { if (!confirm(`Eliminare l'accesso di "${name}"? Irreversibile.`)) e.preventDefault(); }}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="font-display text-[11px] font-bold text-[#C0392B] hover:underline">Elimina</button>
      </form>
    </div>
  );
}
