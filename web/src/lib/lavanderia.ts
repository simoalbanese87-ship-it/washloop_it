import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** La lavanderia a cui mandare un ordine quando nessuno l'ha scelta.
 *
 *  Il problema che risolve
 *  -----------------------
 *  Un ordine prende la lavanderia dalla **fascia** (`slot.laundry_id`). Ma la
 *  lavanderia sulle fasce è facoltativa di proposito — è stato chiesto
 *  esplicitamente: «per la gestione dei ritiri non dobbiamo selezionare per
 *  forza la lavanderia, non deve essere bloccante» — e infatti tutte le fasce
 *  in calendario oggi ce l'hanno vuota.
 *
 *  Risultato: un ordine creato da lì nasce senza lavanderia. E il portale
 *  filtra `o.laundry_id = my_laundry_id()`, quindi quell'ordine **la lavanderia
 *  non lo vede**: un sacco che arriva sul banco senza comparire da nessuna
 *  parte. Non dà errore, non compare in nessuna lista, si scopre quando il
 *  cliente chiama.
 *
 *  Perché il ripiego è sicuro
 *  --------------------------
 *  Si applica **solo se di lavanderia attiva ce n'è esattamente una**. Con una
 *  sola non c'è niente da scegliere e lasciare il campo vuoto è solo un modo di
 *  perdere l'ordine. Il giorno in cui ce ne sarà una seconda questa funzione
 *  restituisce `null` da sola e torna a decidere una persona — che è giusto,
 *  perché a quel punto la scelta esiste davvero.
 *
 *  Non sovrascrive mai una lavanderia già scelta: è un ripiego, non una regola. */
export async function lavanderiaPredefinita(client: SupabaseClient): Promise<string | null> {
  const { data } = await client
    .from("laundries")
    .select("id")
    .eq("active", true)
    .limit(2)
    .returns<{ id: string }[]>();
  const attive = data ?? [];
  return attive.length === 1 ? attive[0].id : null;
}
