"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notifyOrderStatus, notifySpecialAdded } from "@/lib/notify";
import { chargeSpecialById } from "@/lib/billing-specials";
import { statusIndex, type OrderStatus } from "@/lib/orders";

/** Transizioni di stato consentite alla lavanderia (e solo queste). */
const PARTNER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  picked_up: "at_laundry", // segna arrivo in lavanderia
  at_laundry: "washing", // avvia lavaggio
  washing: "ready", // pronto per la riconsegna
};

async function requirePartner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "partner" || !profile.laundry_id) {
    throw new Error("Accesso non autorizzato");
  }
  return profile;
}

/** Verifica (via service role) che l'ordine appartenga alla lavanderia del partner. */
async function assertOrderInLaundry(orderId: string, laundryId: string) {
  const svc = createServiceClient();
  const { data, error } = await svc.from("orders").select("id, laundry_id, status").eq("id", orderId).single();
  if (error || !data) throw new Error("Ordine non trovato");
  if (data.laundry_id !== laundryId) throw new Error("Ordine di un'altra lavanderia");
  return data as { id: string; laundry_id: string; status: OrderStatus };
}

/** Avanza lo stato dell'ordine secondo il flusso lavanderia. */
export async function advanceStatus(formData: FormData) {
  const profile = await requirePartner();
  const orderId = String(formData.get("order_id") ?? "");
  const order = await assertOrderInLaundry(orderId, profile.laundry_id!);

  const next = PARTNER_TRANSITIONS[order.status];
  if (!next) throw new Error(`Transizione non consentita da "${order.status}"`);

  // Update via client RLS (policy "orders partner update" filtra su my_laundry_id()).
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status: next }).eq("id", orderId);
  if (error) throw new Error(error.message);

  await notifyOrderStatus(orderId, next);
  revalidatePath("/laundry");
  revalidatePath(`/laundry/${orderId}`);
}

/** Stati gestibili dalla lavanderia (colonne del board). */
const PARTNER_STATUSES: OrderStatus[] = ["picked_up", "at_laundry", "washing", "ready"];

/** Imposta lo stato dell'ordine su uno degli stati lavanderia (usato dal
 *  drag-and-drop: drop in una colonna = quello stato). Consente anche di tornare
 *  indietro. Notifica il cliente solo in avanzamento (evita notifiche spurie). */
export async function setPartnerStatus(orderId: string, status: string) {
  const profile = await requirePartner();
  if (!PARTNER_STATUSES.includes(status as OrderStatus)) throw new Error("Stato non consentito");
  const order = await assertOrderInLaundry(orderId, profile.laundry_id!);
  if (order.status === status) return;

  const supabase = await createClient(); // RLS: solo ordini della propria lavanderia
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw new Error(error.message);

  if (statusIndex(status as OrderStatus) > statusIndex(order.status)) {
    await notifyOrderStatus(orderId, status as OrderStatus);
  }
  revalidatePath("/laundry");
  revalidatePath(`/laundry/${orderId}`);
}

/** Aggiunge un capo speciale all'ordine.
 *  Lo snapshot di comp_lav E price_cli è preso lato server dal listino:
 *  il partner non conosce né invia mai il prezzo cliente. */
export async function addSpecial(formData: FormData) {
  const profile = await requirePartner();
  const orderId = String(formData.get("order_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const qty = Math.max(1, parseInt(String(formData.get("qty") ?? "1"), 10) || 1);
  if (!itemId) throw new Error("Capo obbligatorio");

  await assertOrderInLaundry(orderId, profile.laundry_id!);

  const svc = createServiceClient();
  const { data: item, error: itemErr } = await svc
    .from("special_items")
    .select("id, name, comp_lav_cents, price_cli_cents, active")
    .eq("id", itemId)
    .single();
  if (itemErr || !item) throw new Error("Capo non a listino");
  if (!item.active) throw new Error("Capo non più disponibile");

  const { data: inserted, error } = await svc
    .from("order_specials")
    .insert({
      order_id: orderId,
      item_id: item.id,
      item_name: item.name, // snapshot
      qty,
      comp_lav_cents: item.comp_lav_cents, // snapshot col. D
      price_cli_cents: item.price_cli_cents, // snapshot col. E (mai esposto al partner)
      added_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !inserted) throw new Error(error?.message ?? "Errore inserimento capo");

  // Ledger: costo dovuto alla lavanderia per l'extra (comp_lav, IVA escl.). Best-effort.
  await svc.from("laundry_payouts").insert({
    laundry_id: profile.laundry_id,
    order_id: orderId,
    special_id: inserted.id,
    kind: "special",
    amount_cents: item.comp_lav_cents * qty,
    status: "pending",
  });

  // Auto-addebito al cliente (invoice item sulla prossima fattura) + notifica
  // immediata. Best-effort: se Stripe fallisce, il capo resta e l'admin può
  // addebitarlo dopo. L'admin può annullare l'addebito finché la fattura è aperta.
  try {
    const res = await chargeSpecialById(svc, inserted.id);
    if (res.ok) await notifySpecialAdded(res.customerId, { itemName: res.itemName, priceCents: res.priceCents, orderId });
  } catch (err) {
    console.error(`[partner] auto-charge special ${inserted.id} fallito:`, err);
  }

  revalidatePath(`/laundry/${orderId}`);
}

/** Rimuove un capo speciale, solo se non ancora addebitato al cliente. */
export async function removeSpecial(formData: FormData) {
  const profile = await requirePartner();
  const orderId = String(formData.get("order_id") ?? "");
  const specialId = String(formData.get("special_id") ?? "");
  await assertOrderInLaundry(orderId, profile.laundry_id!);

  const svc = createServiceClient();
  const { data: row } = await svc.from("order_specials").select("id, order_id, charged_at").eq("id", specialId).single();
  if (!row || row.order_id !== orderId) throw new Error("Capo non trovato");
  if (row.charged_at) throw new Error("Già addebitato: non rimovibile");

  // Azzera il payout dovuto alla lavanderia per questo capo.
  await svc.from("laundry_payouts").update({ status: "void" }).eq("special_id", specialId);

  const { error } = await svc.from("order_specials").delete().eq("id", specialId);
  if (error) throw new Error(error.message);

  revalidatePath(`/laundry/${orderId}`);
}
