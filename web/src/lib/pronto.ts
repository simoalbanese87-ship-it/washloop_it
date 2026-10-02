import "server-only";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { incassaExtraDelRitiro } from "@/lib/incasso-extra";
import { notificaExtraIncassati } from "@/lib/notify";
import type { OrderStatus } from "@/lib/orders";

/** Portare un ordine a «pronto», con tutto quello che significa.
 *
 *  Non è un'etichetta sul tabellone: è il momento in cui il sacco è finito, il
 *  totale dei capi extra è completo e non può più arrivarne un altro, e quindi
 *  **si incassa**. Prima l'addebito restava agganciato all'abbonamento e
 *  diventava soldi solo alla fattura di rinnovo: su un cliente che disdiceva
 *  prima, mai.
 *
 *  Sta qui, e non dentro l'azione della lavanderia, perché da oggi preme quel
 *  passaggio anche il rider — quando carica i sacchi in lavanderia senza
 *  aspettare che qualcuno di là prema il bottone. Due copie di questa sequenza
 *  sarebbero due modi diversi di incassare i capi extra, ed è il genere di
 *  divergenza che si scopre da un ammanco.
 *
 *  Non lancia per l'incasso: il lavoro fisico è già stato fatto, e un sacco
 *  pronto che resta «in lavorazione» sul tabellone è un danno peggiore di un
 *  incasso mancato, che almeno si vede e si rimedia.
 *
 *  Ritorna lo stato raggiunto — `delivery_scheduled` se la fascia di riconsegna
 *  c'era già, altrimenti `ready` — che è anche lo stato da notificare al
 *  cliente quando chi chiama vuole mandare una notifica sola. */
export async function portaAPronto(orderId: string): Promise<OrderStatus> {
  const svc = createServiceClient();

  const { error } = await svc.from("orders").update({ status: "ready" }).eq("id", orderId);
  if (error) throw new Error(error.message);

  const esito = await incassaExtraDelRitiro(svc, orderId);
  if (esito.esito === "incassato") {
    await notificaExtraIncassati(orderId, esito.totaleCents);
  }
  revalidatePath("/admin/extra");
  revalidatePath("/admin");

  return await programmaRiconsegnaSeScelta(orderId);
}

/** Se il cliente ha già scelto la fascia di riconsegna in prenotazione, «pronto»
 *  non è un punto d'attesa: l'appuntamento c'è già, e l'ordine va direttamente
 *  in «riconsegna programmata» perché entri nel giro del rider.
 *
 *  Scrive con il service role di proposito: è una transizione di sistema, non
 *  un gesto della lavanderia — che infatti non ha il permesso di portare un
 *  ordine oltre `ready`.
 *
 *  Ritorna lo stato da notificare al cliente. Una notifica sola: «è pronto» e
 *  subito dopo «te lo riportiamo giovedì» sono due messaggi per una notizia, e
 *  il secondo contiene già il primo.
 *
 *  Nota per chi passerà di qui: NON aggiungere un controllo «la fascia è già
 *  passata, allora non promuovere». L'ho fatto il 3 settembre pensando di
 *  evitare una data morta, e il 4 mattina è costato un sacco invisibile.
 *
 *  La lavanderia ha segnato pronti tre ordini alle 10:05; quello di Saverio
 *  aveva la fascia alle 09:00, passata da un'ora, ed è rimasto su «pronto» —
 *  cioè fuori dal giro del rider, che intanto era in strada a consegnare gli
 *  altri due, con la sua borsa a due metri. Nessuno riprogramma niente in
 *  quel momento: il rider è là, il sacco è là, la consegna è oggi.
 *
 *  Una fascia scaduta di un'ora non è una data morta, è una consegna in
 *  ritardo — e le fermate arretrate il giro del rider le mostra già apposta. */
export async function programmaRiconsegnaSeScelta(orderId: string): Promise<OrderStatus> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("orders")
    .select("delivery_slot_id")
    .eq("id", orderId)
    .maybeSingle<{ delivery_slot_id: string | null }>();
  if (!data?.delivery_slot_id) return "ready";

  const { error } = await svc.from("orders").update({ status: "delivery_scheduled" }).eq("id", orderId);
  if (error) {
    // Meglio un ordine fermo su `ready` — che l'ops vede e programma a mano —
    // che un errore in faccia a chi ha appena fatto il suo lavoro.
    console.error(`[pronto] riconsegna automatica non riuscita per ${orderId}:`, error.message);
    return "ready";
  }
  return "delivery_scheduled";
}
