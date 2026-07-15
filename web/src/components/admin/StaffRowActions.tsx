"use client";

import { resetStaffPassword, deleteStaff } from "@/lib/actions/staff";

/** Azioni per un membro staff: reinvia credenziali + elimina (con conferma). */
export function StaffRowActions({ id, name }: { id: string; name: string }) {
  return (
    <div className="flex flex-none items-center gap-3">
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
