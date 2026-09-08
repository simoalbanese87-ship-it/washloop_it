import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/** Registra quanto dobbiamo alla lavanderia per i sacchi di un ordine.
 *
 *  Nel registro `laundry_payouts` finivano soltanto i capi speciali: la riga
 *  `kind='bag'` — che è la voce **maggiore** del dovuto — non veniva scritta da
 *  nessuna parte. Il "Da dare" mostrato in Home era quindi un calcolo al volo
 *  su `orders.bags`, con 8,00 € di ripiego quando la lavanderia non ha un
 *  compenso configurato: un numero che nessuno poteva verificare ordine per
 *  ordine, e che al momento del bonifico non si sarebbe potuto giustificare.
 *
 *  Si scrive alla consegna, non al ritiro: prima di allora il lavoro potrebbe
 *  ancora non essere stato fatto.
 *
 *  Idempotente: una sola riga `bag` per ordine, anche se lo stato passa da
 *  `delivered` più volte (succede con "cliente assente" seguito da un nuovo
 *  tentativo). */
export async function registraSacchiLavanderia(orderId: string): Promise<void> {
  try {
    const svc = createServiceClient();

    const { data: ordine } = await svc
      .from("orders")
      .select("id, bags, bags_arrivati, laundry_id, laundries(bag_comp_cents)")
      .eq("id", orderId)
      .maybeSingle<{ id: string; bags: number | null; bags_arrivati: number | null; laundry_id: string | null; laundries: { bag_comp_cents: number | null } | null }>();

    if (!ordine?.laundry_id) return; // ordine senza lavanderia: niente da pagare

    const { data: gia } = await svc
      .from("laundry_payouts")
      .select("id")
      .eq("order_id", orderId)
      .eq("kind", "bag")
      .maybeSingle<{ id: string }>();
    if (gia) return;

    const rel = ordine.laundries as unknown as { bag_comp_cents: number | null }[] | { bag_comp_cents: number | null } | null;
    const lav = Array.isArray(rel) ? rel[0] : rel;
    const compenso = lav?.bag_comp_cents ?? 1500;

    // Quanti sacchi si pagano, in ordine di attendibilità.
    //
    // 1. **Quelli contati dalla lavanderia**, se li ha confermati: è l'unico
    //    numero osservato sul banco invece che previsto o dedotto.
    // 2. **Quelli scansionati dal rider**, se nessuno ha contato: almeno
    //    corrisponde a un gesto fatto davanti alla porta.
    // 3. `bags`, solo se non c'è stata nessuna scansione — ritiro segnato a
    //    mano senza scanner. Senza questo terzo scalino pagheremmo zero.
    //
    // Prima si pagava sempre `bags`, cioè la stima fatta in prenotazione giorni
    // prima: l'8 settembre fabia aveva 2 sacchi dichiarati dall'abbonamento e
    // ne ha consegnato uno, e il compenso sarebbe uscito doppio.
    const { count: scansionati } = await svc
      .from("order_bags")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .not("pickup_scanned_at", "is", null);
    const sacchi = ordine.bags_arrivati ?? (scansionati && scansionati > 0 ? scansionati : ordine.bags ?? 1);

    const { error } = await svc.from("laundry_payouts").insert({
      laundry_id: ordine.laundry_id,
      order_id: orderId,
      kind: "bag",
      amount_cents: compenso * sacchi,
      status: "pending",
    });
    if (error) console.error(`[payout] riga sacchi per ${orderId} non scritta:`, error.message);
  } catch (err) {
    // Best-effort come le notifiche: un problema qui non deve impedire al rider
    // di chiudere la consegna.
    console.error(`[payout] registraSacchiLavanderia(${orderId}) fallita:`, err);
  }
}
