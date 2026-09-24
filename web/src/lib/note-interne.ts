import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizzaNota } from "@/lib/nota-persona";

/** Scrive la nota interna di un cliente, da qualunque schermata arrivi.
 *
 *  Esiste perché i punti d'ingresso sono due — la textarea nella scheda del
 *  cliente e la colonna in /admin/persone — e due copie della stessa logica
 *  divergono: basta che una delle due dimentichi `updated_by`, o cancelli
 *  quando l'altra salva, perché l'admin veda due note diverse per la stessa
 *  persona senza sapere quale vale.
 *
 *  Le note stanno in `customer_notes` e non su `profiles` perché la GRANT
 *  SELECT concessa su quella tabella copre ogni colonna futura: una nota
 *  interna messa lì sarebbe leggibile dal cliente. (Verificato con
 *  `has_column_privilege` prima di scegliere, vedi migration 0063.) */
export async function salvaNotaCliente(
  svc: SupabaseClient,
  customerId: string,
  grezzo: string | null | undefined,
  autoreId: string | null,
): Promise<{ error: string | null }> {
  const nota = normalizzaNota(grezzo);

  // Vuota significa cancella, non «salva una riga vuota»: una nota che non dice
  // niente in elenco si legge come una nota che non è stata letta.
  const { error } = nota
    ? await svc.from("customer_notes").upsert({
        customer_id: customerId,
        note: nota,
        updated_at: new Date().toISOString(),
        updated_by: autoreId,
      })
    : await svc.from("customer_notes").delete().eq("customer_id", customerId);

  return { error: error?.message ?? null };
}
