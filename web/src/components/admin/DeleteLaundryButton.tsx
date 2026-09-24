"use client";

import { deleteLaundry } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";

/** Elimina definitivo lavanderia (scollega ordini + rimuove slot). Conferma. */
export function DeleteLaundryButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteLaundry}
      onSubmit={(e) => { if (!confirm(`Eliminare definitivamente la lavanderia "${name}"? Gli ordini verranno scollegati e gli slot rimossi. Irreversibile.`)) e.preventDefault(); }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="md" variant="ghost-navy">Elimina</Button>
    </form>
  );
}
