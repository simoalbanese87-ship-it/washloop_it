import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Gli ordini di un cliente che cadono dentro un ciclo pagato.
 *
 *  Stava dentro `passaggi-abbonamento.ts` come funzione privata. Da quando
 *  anche i capi compresi nel canone si contano per ciclo, la stessa domanda si
 *  fa in due posti — e due letture diverse di «quali ordini stanno in questo
 *  ciclo», nella stessa schermata, è il modo in cui due numeri cominciano a
 *  contraddirsi senza che nessuno sappia quale credere.
 *
 *  Cosa conta: **un ordine non annullato il cui ritiro cade dentro il ciclo**.
 *  Si guarda la fascia di ritiro, come fa Competenza; se l'ordine non ha
 *  ancora una fascia — succede su quelli creati a mano — vale la data di
 *  creazione, che è l'unica altra cosa vera che abbiamo.
 *
 *  **Service client**: decide cosa si addebita a un cliente che paga, e una
 *  policy che nega torna una lista vuota invece di un errore. */

export type Ciclo = { dalIso: string; alIso: string };

/** Il margine indietro sulla creazione: un ordine creato prima del ciclo ma con
 *  il ritiro dentro conta lo stesso, ed è il caso normale di chi prenota con
 *  una settimana di anticipo. */
const MARGINE_MS = 60 * 24 * 3600 * 1000;

export async function ordiniDelCiclo(
  svc: SupabaseClient,
  customerId: string,
  ciclo: Ciclo,
): Promise<string[]> {
  const { data } = await svc
    .from("orders")
    .select("id, created_at, status, ritiro:slots!orders_pickup_slot_id_fkey(starts_at)")
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    .gte("created_at", new Date(new Date(ciclo.dalIso).getTime() - MARGINE_MS).toISOString())
    .returns<{ id: string; created_at: string; status: string; ritiro: { starts_at: string } | { starts_at: string }[] | null }[]>();

  // Finestra mezza aperta: il giorno del rinnovo appartiene al ciclo nuovo, o
  // un ritiro fatto quel giorno si conterebbe in tutti e due.
  const dentro = (iso: string) => iso >= ciclo.dalIso && iso < ciclo.alIso;

  return (data ?? [])
    .filter((o) => {
      const rel = o.ritiro;
      const slot = Array.isArray(rel) ? rel[0] ?? null : rel;
      return dentro(slot?.starts_at ?? o.created_at);
    })
    .map((o) => o.id);
}
