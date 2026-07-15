"use client";

import { deleteCustomer } from "@/lib/actions/admin-customer";

/** Pulsante elimina definitivo per lead/cliente (site). Conferma prima di agire.
 *  I clienti con abbonamento attivo vengono bloccati lato server (banner). */
export function DeleteUserButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteCustomer}
      onSubmit={(e) => { if (!confirm(`Eliminare definitivamente "${name}" e tutti i suoi dati? L'azione è irreversibile.`)) e.preventDefault(); }}
    >
      <input type="hidden" name="customer_id" value={id} />
      <button type="submit" className="font-display text-[11px] font-bold text-[#C0392B] hover:underline" title="Elimina definitivamente">
        Elimina
      </button>
    </form>
  );
}
