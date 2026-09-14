import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { riderPerIndirizzo } from "@/lib/rider-predefinito";
import { notifyCourierAssigned } from "@/lib/notify";

/** Mette il rider su un ordine appena creato, se si può capire da solo chi è.
 *
 *  La regola sta in `rider-predefinito.ts`; qui c'è solo il gesto: scrivere e
 *  avvisare. Si chiama subito dopo l'insert, dai tre punti in cui un ordine
 *  nasce — prenotazione dal sito, prenotazione multi-step, cron delle
 *  ricorrenze — perché nascevano tutti scoperti.
 *
 *  Non solleva mai: un ordine creato e senza rider è un problema da risolvere
 *  premendo «assegna» nel board, un ordine non creato è un cliente perso. Se
 *  qualcosa qui non va, si torna esattamente al comportamento di prima. */
export async function assegnaRiderIniziale(svc: SupabaseClient, orderId: string, addressId: string | null): Promise<string | null> {
  try {
    const rider = await riderPerIndirizzo(svc, addressId);
    if (!rider) return null;
    const { error } = await svc.from("orders").update({ courier_id: rider }).eq("id", orderId).is("courier_id", null);
    if (error) return null;
    await notifyCourierAssigned(orderId);
    return rider;
  } catch {
    return null;
  }
}
