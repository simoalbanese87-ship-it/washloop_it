"use client";

import { deleteOrder } from "@/lib/actions/items";

/** Eliminazione definitiva di un ordine chiuso. Serve a ripulire i dati di prova
 *  senza aprire il database.
 *
 *  La conferma dice cosa sparisce davvero: con l'ordine se ne vanno capi, foto,
 *  cronologia e borse. È l'unica azione irreversibile del pannello, quindi il
 *  testo è esplicito invece di un generico "sei sicuro?". */
export function DeleteOrderButton({ id, code }: { id: string; code: string }) {
  return (
    <form
      action={deleteOrder}
      onSubmit={(e) => {
        if (
          !confirm(
            `Eliminare per sempre l'ordine ${code}?\n\nSpariscono anche capi, foto prova, cronologia e borse collegate. L'azione non si può annullare.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="order_id" value={id} />
      <button type="submit" className="font-display text-sm font-bold text-[#C0392B] hover:underline">
        Elimina definitivamente
      </button>
    </form>
  );
}
