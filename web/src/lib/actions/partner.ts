"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notifyOrderStatus, notifySpecialAdded, notifySegnalazioneCliente, notifySegnalazioneOps } from "@/lib/notify";
import { chargeSpecialById } from "@/lib/billing-specials";
import { LAVORAZIONE_APERTA, statusIndex, type OrderStatus } from "@/lib/orders";
import { SEGNALABILE, avvisaSubitoIlCliente, fotoObbligatoria, isTipoSegnalazione } from "@/lib/segnalazioni";

/** Transizioni di stato consentite alla lavanderia (e solo queste). */
const PARTNER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  picked_up: "at_laundry", // segna arrivo in lavanderia
  at_laundry: "washing", // avvia lavaggio
  washing: "ready", // pronto per la riconsegna
};

/** Se il cliente ha già scelto la fascia di riconsegna in prenotazione, «pronto»
 *  non è un punto d'attesa: l'appuntamento c'è già, e l'ordine va direttamente
 *  in «riconsegna programmata» perché entri nel giro del rider.
 *
 *  Scrive con il service role di proposito: è una transizione di sistema, non
 *  un gesto della lavanderia — che infatti non ha il permesso di portare un
 *  ordine oltre `ready`.
 *
 *  Ritorna lo stato da notificare al cliente. Una notifica sola: «è pronto» e
 *  subito dopo «te lo riportiamo giovedì» sono due messaggi per una notizia,
 *  e il secondo contiene già il primo. */
async function programmaRiconsegnaSeScelta(orderId: string): Promise<OrderStatus> {
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
    // che un errore in faccia alla lavanderia per un passaggio non suo.
    console.error(`[partner] riconsegna automatica non riuscita per ${orderId}:`, error.message);
    return "ready";
  }
  return "delivery_scheduled";
}

async function requirePartner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "partner" || !profile.laundry_id) {
    throw new Error("Accesso non autorizzato");
  }
  return profile;
}

/** Scrive lo stato dell'ordine. Da chiamare SOLO dopo `assertOrderInLaundry`.
 *
 *  Scrive con il service role, e non con la sessione della lavanderia, per una
 *  ragione precisa: il partner ha una policy di UPDATE su `orders`, ma non ne
 *  ha nessuna di SELECT — legge tramite la vista `partner_orders`. In
 *  PostgreSQL un `update … where id = …` deve prima *leggere* la riga, e in
 *  quella lettura valgono le policy di SELECT: senza, la `where` non trova
 *  niente. L'UPDATE andava quindi a buon fine su zero righe, senza errore.
 *  Da fuori si vedeva solo un bottone «Segna arrivato» che non faceva nulla:
 *  la pagina si ricaricava identica, e il primo giorno di lavoro vero la
 *  lavanderia non poteva far avanzare nessun sacco.
 *
 *  Il permesso non viene aggirato, viene solo spostato di due righe più su:
 *  `requirePartner()` controlla il ruolo e `assertOrderInLaundry()` controlla
 *  che l'ordine sia di quella lavanderia, entrambi prima di arrivare qui. */
async function scriviStato(orderId: string, status: OrderStatus): Promise<{ error: string | null }> {
  const svc = createServiceClient();
  const { error } = await svc.from("orders").update({ status }).eq("id", orderId);
  return { error: error?.message ?? null };
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

  const { error } = await scriviStato(orderId, next);
  if (error) throw new Error(error);

  const daNotificare = next === "ready" ? await programmaRiconsegnaSeScelta(orderId) : next;
  await notifyOrderStatus(orderId, daNotificare);
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

  const { error } = await scriviStato(orderId, status as OrderStatus);
  if (error) throw new Error(error);

  if (statusIndex(status as OrderStatus) > statusIndex(order.status)) {
    const daNotificare = status === "ready" ? await programmaRiconsegnaSeScelta(orderId) : (status as OrderStatus);
    await notifyOrderStatus(orderId, daNotificare);
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

  const order = await assertOrderInLaundry(orderId, profile.laundry_id!);
  // Il modulo sparisce dalla pagina a lavorazione chiusa, ma la form action è
  // pubblica: chi la richiama dopo "pronto" addebiterebbe il cliente su un
  // sacco già sigillato e in viaggio. Il controllo vero sta qui.
  // Whitelist e non `statusIndex(...) >= statusIndex("ready")`: `cancelled` non
  // sta in ORDER_FLOW, l'indice sarebbe -1 e il confronto lo lascerebbe passare.
  if (!LAVORAZIONE_APERTA.includes(order.status)) {
    throw new Error("Lavorazione conclusa: non si aggiungono altri capi");
  }

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

/** La lavanderia segnala un capo: trovato già rovinato, macchia non rimossa,
 *  o danno fatto da loro.
 *
 *  L'azione ritorna un messaggio invece di lanciare: un `throw` dentro una form
 *  action diventa la schermata di errore di Next, e chi sta scrivendo perde il
 *  testo e la foto appena caricata. Stessa scelta già fatta per il rider. */
export async function addIssue(_prev: { error?: string; ok?: string } | null, formData: FormData) {
  let profile;
  try {
    profile = await requirePartner();
  } catch {
    return { error: "Sessione scaduta: ricarica la pagina e rientra." };
  }

  const orderId = String(formData.get("order_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const capo = String(formData.get("capo") ?? "").trim();
  const testo = String(formData.get("testo") ?? "").trim();
  const photo = String(formData.get("photo_url") ?? "").trim() || null;

  if (!isTipoSegnalazione(kind)) return { error: "Scegli di che tipo di segnalazione si tratta." };
  if (!testo) return { error: "Scrivi cosa hai trovato: senza descrizione la segnalazione non serve a nessuno." };
  if (fotoObbligatoria(kind) && !photo) {
    return { error: "Per un danno in lavorazione la foto è obbligatoria: fra un mese è l'unica cosa che resta." };
  }

  let order;
  try {
    order = await assertOrderInLaundry(orderId, profile.laundry_id!);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ordine non trovato" };
  }
  if (!SEGNALABILE.includes(order.status)) {
    return { error: "Questo ordine non è più in lavorazione da voi: per segnalare qualcosa scrivete a ops." };
  }

  // I danni non partono da soli verso il cliente: li pubblica l'ops insieme a
  // cosa gli propone. Gli altri due sì, appena scritti.
  const subito = avvisaSubitoIlCliente(kind);

  const svc = createServiceClient();
  const { data: inserita, error } = await svc
    .from("order_issues")
    .insert({
      order_id: orderId,
      kind,
      capo: capo || null,
      testo,
      photo_url: photo,
      created_by: profile.id,
      published_at: subito ? new Date().toISOString() : null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !inserita) return { error: error?.message ?? "Segnalazione non salvata" };

  // Ops sempre, cliente solo se la segnalazione è già pubblica.
  await notifySegnalazioneOps(inserita.id);
  if (subito) await notifySegnalazioneCliente(inserita.id);

  revalidatePath(`/laundry/${orderId}`);
  revalidatePath(`/admin/ordini/${orderId}`);
  revalidatePath(`/app/ordini/${orderId}`);
  return {
    ok: subito
      ? "Segnalazione inviata. Il cliente è stato avvisato."
      : "Segnalazione inviata a WashLoop. Al cliente ci pensiamo noi: non riceve niente finché non abbiamo deciso come sistemarla.",
  };
}
