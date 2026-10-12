import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sacchiOsservati } from "@/lib/franchigia";
import { haAbbonamentoAttivo } from "@/lib/abbonamento-sacchi";

/** Quanto dovremo alla lavanderia per i sacchi già ritirati ma non ancora
 *  riconsegnati.
 *
 *  Perché esiste
 *  -------------
 *  La riga vera in `laundry_payouts` nasce **alla riconsegna**: prima di allora
 *  il lavoro potrebbe non essere stato fatto, e si paga quello che è successo.
 *  Ma il ricavo matura **alla presa in carico**, e fra i due momenti passano
 *  due o tre giorni in cui la Home diceva «da dare: 9,02 €» mentre in
 *  lavanderia c'erano sei sacchi: due numeri veri, letti in due momenti
 *  diversi, che però in pannello si leggevano come uno sbagliato e uno giusto.
 *
 *  Questo modulo è l'unico posto dove quella cifra si calcola. La usano la Home
 *  (per scrivere «+ X in lavorazione» accanto al maturato) e Competenza (per
 *  imputare il costo alla settimana del ritiro). Finché è una funzione sola, i
 *  due numeri non possono divergere.
 *
 *  Le regole sono quelle di `registraSacchiLavanderia`, apposta: i sacchi
 *  contati dalla lavanderia, poi quelli scansionati dal rider, poi quelli
 *  dichiarati; si paga quello che risulta, anche sopra i sacchi
 *  dell'abbonamento; e niente per chi un abbonamento non ce l'ha, perché il
 *  compenso a sacco è la contropartita del canone. */

export type SaccoPrevisto = {
  orderId: string;
  clienteId: string;
  /** Il giorno della presa in carico: la fascia di ritiro, o la creazione. */
  giorno: string;
  cents: number;
};

type Ordine = {
  id: string;
  customer_id: string | null;
  status: string;
  bags: number | null;
  bags_arrivati: number | null;
  created_at: string;
  laundry_id: string | null;
  laundries: { bag_comp_cents: number | null } | { bag_comp_cents: number | null }[] | null;
  servizio_sacco_id: string | null;
  servizi_sacco: { comp_lav_cents: number } | { comp_lav_cents: number }[] | null;
  pickup: { starts_at: string } | { starts_at: string }[] | null;
  profiles: { is_test: boolean } | { is_test: boolean }[] | null;
};

const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/** Il giorno a cui appartiene l'ordine: il ritiro se c'è, altrimenti quando è
 *  stato creato. Stessa regola usata in Competenza. */
export const giornoDellOrdine = (o: { created_at: string; pickup?: unknown }): string =>
  (uno(o.pickup as { starts_at: string } | { starts_at: string }[] | null | undefined)?.starts_at ?? o.created_at);

/** Un ritiro ancora da fare non è un costo: contano solo gli ordini usciti da
 *  «ritiro programmato», cioè presi in carico davvero. */
const presoInCarico = (status: string) => status !== "pickup_scheduled" && status !== "requested";

export async function sacchiInLavorazione(
  svc: SupabaseClient,
  opzioni: { includiProva?: boolean; dal?: string } = {},
): Promise<SaccoPrevisto[]> {
  const { includiProva = false, dal } = opzioni;

  let q = svc
    .from("orders")
    .select(
      "id, customer_id, status, bags, bags_arrivati, created_at, laundry_id, " +
        "servizio_sacco_id, laundries(bag_comp_cents), servizi_sacco(comp_lav_cents), " +
        "pickup:slots!orders_pickup_slot_id_fkey(starts_at), " +
        "profiles!orders_customer_id_fkey(is_test)",
    )
    .neq("status", "cancelled")
    .not("laundry_id", "is", null);
  if (dal) q = q.gte("created_at", dal);
  const { data: ordini } = await q.returns<Ordine[]>();

  const candidati = (ordini ?? []).filter(
    (o) => o.customer_id && presoInCarico(o.status) && (includiProva || !uno(o.profiles)?.is_test),
  );
  if (candidati.length === 0) return [];

  // Chi ha già la riga vera esce: il suo costo è nel registro, e contarlo due
  // volte farebbe sembrare il mese peggiore di com'è.
  const { data: payouts } = await svc
    .from("laundry_payouts")
    .select("order_id")
    .eq("kind", "bag")
    .neq("status", "void")
    .in("order_id", candidati.map((o) => o.id))
    .returns<{ order_id: string | null }[]>();
  const gia = new Set((payouts ?? []).map((p) => p.order_id).filter(Boolean) as string[]);

  const daImputare = candidati.filter((o) => !gia.has(o.id));
  if (daImputare.length === 0) return [];

  const { data: tag } = await svc
    .from("order_bags")
    .select("order_id")
    .in("order_id", daImputare.map((o) => o.id))
    .not("pickup_scanned_at", "is", null)
    .returns<{ order_id: string }[]>();
  const scansioni = new Map<string, number>();
  for (const t of tag ?? []) scansioni.set(t.order_id, (scansioni.get(t.order_id) ?? 0) + 1);

  const clienti = [...new Set(daImputare.map((o) => o.customer_id!))];
  const conAbbonamento = new Map<string, boolean>();
  await Promise.all(clienti.map(async (id) => conAbbonamento.set(id, await haAbbonamentoAttivo(svc, id))));

  const previsti: SaccoPrevisto[] = [];
  for (const o of daImputare) {
    // Il servizio a sacco non passa dall'abbonamento: lì il sacco è tutto il
    // rapporto, e la stireria va pagata comunque. Stessa eccezione di
    // `registraSacchiLavanderia`, e per lo stesso motivo.
    if (!o.servizio_sacco_id && !conAbbonamento.get(o.customer_id!)) continue;
    const compenso = uno(o.servizi_sacco)?.comp_lav_cents ?? uno(o.laundries)?.bag_comp_cents ?? 1500;
    const sacchi = sacchiOsservati(o.bags_arrivati, scansioni.get(o.id) ?? 0, o.bags ?? 0);
    if (sacchi <= 0) continue;
    previsti.push({
      orderId: o.id,
      clienteId: o.customer_id!,
      giorno: giornoDellOrdine(o),
      cents: compenso * sacchi,
    });
  }
  return previsti;
}
