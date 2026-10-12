import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scegliLavanderia } from "@/lib/lavanderia-scelta";

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
 *  Non sovrascrive mai una lavanderia già scelta: è un ripiego, non una regola.
 *
 *  **Va chiamata col service client.** Su `laundries` la policy fa leggere solo
 *  rider, lavanderia e admin: passando la sessione di un cliente la query non
 *  dà errore, torna vuota — e una lista vuota qui significa «non c'è una sola
 *  lavanderia attiva», cioè nessun ripiego. È così che il 14 settembre due
 *  ritiri sono nati senza lavanderia e sono arrivati sul banco senza comparire
 *  in nessuna lista. */
export async function lavanderiaPredefinita(client: SupabaseClient): Promise<string | null> {
  // «Una sola attiva» da ottobre 2026 vuol dire **una sola generale**: la
  // stireria di Arluno è attiva ma fa solo stiro, e contarla qui avrebbe spento
  // il ripiego per tutti gli altri ordini — che è esattamente il guasto che
  // questa funzione esiste per evitare.
  const generali = await lavanderieGenerali(client);
  return scegliLavanderia({ generali });
}

/** Le lavanderie generali attive: quelle che non sono dedicate a un servizio a
 *  sacco. La stireria di Arluno fa solo stiro, e contarla fra le candidate
 *  avrebbe spento il ripiego per tutti gli altri ordini. */
export async function lavanderieGenerali(client: SupabaseClient): Promise<string[]> {
  const [{ data: attive }, { data: dedicate }] = await Promise.all([
    client.from("laundries").select("id").eq("active", true).returns<{ id: string }[]>(),
    client.from("servizi_sacco").select("laundry_id").not("laundry_id", "is", null).returns<{ laundry_id: string }[]>(),
  ]);
  const fuori = new Set((dedicate ?? []).map((d) => d.laundry_id));
  return (attive ?? []).map((l) => l.id).filter((id) => !fuori.has(id));
}

/** Dove va questo ritiro, e con quale servizio a sacco.
 *
 *  Due risposte insieme perché sono la stessa decisione: se il cliente fa solo
 *  stiro, l'ordine nasce con quel servizio **e** va alla stireria. Tenerle
 *  separate vorrebbe dire poterle sbagliare una per volta — un sacco di stiro
 *  alla lavanderia storica, o un sacco normale senza prezzo.
 *
 *  Come `lavanderiaPredefinita`, va chiamata col **service client**: con la
 *  sessione del cliente le query non falliscono, tornano vuote. */
export async function destinazioneOrdine(
  client: SupabaseClient,
  customerId: string,
  fasciaLaundryId?: string | null,
): Promise<{ laundryId: string | null; servizioSaccoId: string | null }> {
  const { data: prof } = await client
    .from("profiles")
    .select("servizio_sacco_id, servizi_sacco(id, laundry_id, active)")
    .eq("id", customerId)
    .maybeSingle<{ servizio_sacco_id: string | null; servizi_sacco: { id: string; laundry_id: string | null; active: boolean } | { id: string; laundry_id: string | null; active: boolean }[] | null }>();

  const rel = prof?.servizi_sacco;
  const servizio = Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
  const attivo = servizio?.active ? servizio : null;

  return {
    laundryId: scegliLavanderia({
      servizio: attivo?.laundry_id ?? null,
      fascia: fasciaLaundryId ?? null,
      generali: await lavanderieGenerali(client),
    }),
    servizioSaccoId: attivo?.id ?? null,
  };
}
