import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { dataAddebito, vaAggiornata, type Addebito } from "@/lib/prova";
import { TURNAROUND_ORE } from "@/lib/planning-rider";

/** Sposta l'addebito della prova al giorno dopo la riconsegna prevista.
 *
 *  Si chiama dopo che un ordine è nato, si è spostato o è stato disdetto —
 *  dagli stessi punti di `assegnaRiderIniziale`, e per lo stesso motivo: è un
 *  gesto che segue la creazione, non una condizione per farla.
 *
 *  **Non solleva mai.** Un ordine creato e un addebito rimasto al paracadute è
 *  un problema da qualche giorno di ricavo; un ordine non creato è un cliente
 *  perso. Se Stripe non risponde, la prova resta dov'era: finisce comunque,
 *  perché la sua data è stata messa alla creazione e non da qui.
 *
 *  Un ordine solo fa da ancora. Chi prenota due ritiri nella stessa settimana
 *  ha prenotato due sacchi, non due settimane. */
export async function allineaProva(
  svc: SupabaseClient,
  customerId: string,
  ordineId: string | null,
  motivo: "primo-ordine" | "ritiro-spostato" | "ordine-disdetto",
): Promise<Addebito | null> {
  try {
    const { data: sub } = await svc
      .from("subscriptions")
      .select("id, status, prova_fine_at, prova_tetto_at, prova_ordine_id, activated_at, created_at, stripe_subscription_id")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        status: string;
        prova_fine_at: string | null;
        prova_tetto_at: string | null;
        prova_ordine_id: string | null;
        activated_at: string | null;
        created_at: string;
        stripe_subscription_id: string | null;
      }>();

    // Il caso normale: chi è già cliente pagante non ha niente da spostare.
    // Non è un errore e non si registra da nessuna parte.
    if (!sub || sub.status !== "trialing" || !sub.stripe_subscription_id) return null;

    const ancorato = sub.prova_ordine_id;
    if (motivo === "ordine-disdetto") {
      // Solo la disdetta dell'ordine-ancora rilascia l'ancora; le altre non
      // toccano niente.
      if (!ancorato || ancorato !== ordineId) return null;
    } else if (ancorato && ancorato !== ordineId) {
      return null;
    }

    const inizio = sub.activated_at ?? sub.created_at;
    let ancora = null;
    let nuovoOrdine: string | null = null;

    if (motivo !== "ordine-disdetto" && ordineId) {
      const { data: ord } = await svc
        .from("orders")
        .select("id, eta_ready_at, status, pickup:slots!orders_pickup_slot_id_fkey(starts_at), consegna:slots!orders_delivery_slot_id_fkey(starts_at)")
        .eq("id", ordineId)
        .maybeSingle<{
          id: string;
          eta_ready_at: string | null;
          status: string;
          pickup: { starts_at: string } | { starts_at: string }[] | null;
          consegna: { starts_at: string } | { starts_at: string }[] | null;
        }>();
      if (ord && ord.status !== "cancelled") {
        // PostgREST tipizza l'innesto uno-a-uno come oggetto ma a volte lo dà
        // come array: leggerlo in un modo solo perderebbe la fascia in silenzio.
        const uno = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
        ancora = {
          riconsegnaIso: uno(ord.consegna)?.starts_at ?? null,
          etaProntoIso: ord.eta_ready_at,
          ritiroIso: uno(ord.pickup)?.starts_at ?? null,
          turnaroundOre: TURNAROUND_ORE,
        };
        nuovoOrdine = ord.id;
      }
    }

    // Senza ancora si torna al paracadute, cioè dove sta chi non ha mai
    // prenotato. Non al tetto: chi disdice non deve finire meglio di chi non ha
    // mai provato.
    const esito = dataAddebito(ancora, inizio, {
      giorniTetto: sub.prova_tetto_at
        ? Math.max(0, Math.round((Date.parse(sub.prova_tetto_at) - Date.parse(inizio)) / 86_400_000))
        : undefined,
    });

    if (!vaAggiornata(sub.prova_fine_at, esito.quando)) return esito;

    // La nostra riga può essere vecchia di minuti: prima di muovere un addebito
    // si guarda cosa dice Stripe adesso.
    const vivo = await stripe().subscriptions.retrieve(sub.stripe_subscription_id);
    if (vivo.status !== "trialing") return null;

    await stripe().subscriptions.update(sub.stripe_subscription_id, {
      trial_end: Math.floor(Date.parse(esito.quando) / 1000),
      proration_behavior: "none",
    });

    // Si scrive anche qui, oltre al webhook che riarriverà: serve perché la
    // pagina del cliente sia giusta **subito** dopo la prenotazione, senza
    // aspettare Stripe. Stesso motivo per cui esiste `syncFromCheckoutSession`.
    await svc
      .from("subscriptions")
      .update({ prova_fine_at: esito.quando, prova_ordine_id: nuovoOrdine })
      .eq("id", sub.id);

    return esito;
  } catch (err) {
    const { registraGuasto } = await import("@/lib/incidenti");
    await registraGuasto(
      "stripe",
      "Addebito della prova non spostato",
      {
        cliente: customerId,
        ordine: ordineId ?? null,
        motivo,
        errore: err instanceof Error ? err.message : String(err),
      },
    );
    return null;
  }
}
