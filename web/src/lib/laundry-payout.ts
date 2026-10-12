import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sacchiOsservati } from "@/lib/franchigia";
import { haAbbonamentoAttivo } from "@/lib/abbonamento-sacchi";
import { dataServizio } from "@/lib/periodo-servizio";

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
      .select("id, customer_id, bags, bags_arrivati, laundry_id, servizio_sacco_id, laundries(bag_comp_cents), servizi_sacco(comp_lav_cents)")
      .eq("id", orderId)
      .maybeSingle<{ id: string; customer_id: string; bags: number | null; bags_arrivati: number | null; laundry_id: string | null; servizio_sacco_id: string | null; laundries: { bag_comp_cents: number | null } | null; servizi_sacco: { comp_lav_cents: number } | { comp_lav_cents: number }[] | null }>();

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
    // Su un servizio a sacco il compenso è quello del servizio, non quello
    // generico della lavanderia: lo stiro di un sacco e il lavaggio di un sacco
    // costano cifre diverse e li fa lo stesso banco.
    const relServizio = ordine.servizi_sacco;
    const servizio = Array.isArray(relServizio) ? relServizio[0] ?? null : relServizio ?? null;
    const compenso = servizio?.comp_lav_cents ?? lav?.bag_comp_cents ?? 1500;

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

    // 4. **E se non c'è nessun abbonamento, non c'è nessun sacco da pagare.**
    //
    // Il compenso a sacco è la contropartita del canone: la lavanderia ce lo
    // fattura perché il cliente ha un abbonamento, e dentro quel compenso ci
    // stanno anche i capi compresi. Su un lavoro a consumo la lavanderia
    // fattura i capi, uno per uno, e quelli hanno già la loro riga `special`.
    // Scrivere anche il sacco sarebbe un costo che nessuno ci ha chiesto, e
    // falserebbe il conto del cliente in Competenza.
    //    L'eccezione è il **servizio a sacco**: lì il sacco è tutto il
    //    rapporto — il cliente paga quel sacco, la stireria lo lavora e ce lo
    //    fattura. Senza questa riga la stireria di Arluno lavorerebbe gratis
    //    nei nostri conti, e il margine del solo stiro sarebbe tutto profitto.
    if (!ordine.servizio_sacco_id && !(await haAbbonamentoAttivo(svc, ordine.customer_id))) return;

    // Si paga quello che risulta registrato, **senza fermarsi al tetto
    // dell'abbonamento**.
    //
    // Fino al 7 ottobre 2026 il conto si fermava ai sacchi compresi nel piano:
    // su uno Small da un sacco, due sacchi lavati ne pagavano uno. Era nato per
    // il guasto dell'8 settembre — due tag letti per sbaglio, compenso doppio —
    // ma risolveva il problema sbagliato: quel giorno il numero era falso, qui
    // il numero è vero. Elvira il 6 ottobre ha dato due sacchi, la lavanderia
    // li ha contati e lavati entrambi, noi le abbiamo addebitato il secondo, e
    // alla lavanderia ne pagavamo uno.
    //
    // Decisione di Simone, 7 ottobre 2026: «si paga il numero di sacchi
    // registrati per quella settimana». Il tetto resta dov'era giusto — sui
    // capi compresi, che sono una promessa dell'abbonamento e non una
    // prestazione della lavanderia.
    const sacchi = sacchiOsservati(ordine.bags_arrivati, scansionati, ordine.bags);

    const { error } = await svc.from("laundry_payouts").insert({
      laundry_id: ordine.laundry_id,
      order_id: orderId,
      kind: "bag",
      amount_cents: compenso * sacchi,
      status: "pending",
      servizio_il: await dataServizio(svc, orderId),
    });
    if (error) console.error(`[payout] riga sacchi per ${orderId} non scritta:`, error.message);
  } catch (err) {
    // Best-effort come le notifiche: un problema qui non deve impedire al rider
    // di chiudere la consegna.
    console.error(`[payout] registraSacchiLavanderia(${orderId}) fallita:`, err);
  }
}
