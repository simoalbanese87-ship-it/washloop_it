"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { haversineKm } from "@/lib/route";
import type { OrderStatus, ScanResult, RiderLivePos } from "@/lib/orders";
import { romeLocalToISO, romeWeekday, romeHHMM } from "@/lib/format";
import { notifyOrderStatus, notifyCourierAssigned } from "@/lib/notify";
import { slotFullMessage } from "@/lib/slots";

/** Cliente: crea un ordine prenotando una lavanderia + slot di ritiro.
 *  Calcola l'ETA "pronto" = inizio ritiro + turnaround del piano attivo. */
export async function createPickup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const address_id = String(formData.get("address_id") ?? "");
  const pickup_slot_id = String(formData.get("pickup_slot_id") ?? "");
  const laundry_id = String(formData.get("laundry_id") ?? "") || null;
  const bags = Number(formData.get("bags") ?? 1);
  if (!address_id || !pickup_slot_id) throw new Error("Indirizzo e slot obbligatori");

  // ETA = inizio slot ritiro + turnaround del piano attivo (default 48h)
  const [{ data: slot }, { data: sub }] = await Promise.all([
    supabase.from("slots").select("starts_at").eq("id", pickup_slot_id).maybeSingle<{ starts_at: string }>(),
    supabase
      .from("subscriptions")
      .select("status, plans(turnaround_hours)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string; plans: { turnaround_hours: number } | null }>(),
  ]);

  // Gate: la prenotazione richiede un abbonamento attivo (difesa lato server).
  if (!sub || !["active", "trialing"].includes(sub.status)) {
    redirect("/app/abbonamento?need=1");
  }
  const turnaround = sub?.plans?.turnaround_hours ?? 48;
  const eta = slot?.starts_at ? new Date(new Date(slot.starts_at).getTime() + turnaround * 3600_000).toISOString() : null;

  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_id: user.id,
      address_id,
      pickup_slot_id,
      laundry_id,
      eta_ready_at: eta,
      bags: Number.isFinite(bags) && bags > 0 ? bags : 1,
      notes: String(formData.get("notes") ?? "") || null,
      status: "pickup_scheduled" as OrderStatus,
    })
    .select("id")
    .single();
  if (error) throw new Error(slotFullMessage(error) ?? error.message);

  await notifyOrderStatus(data!.id, "pickup_scheduled");
  revalidatePath("/app");
  redirect(`/app/ordini/${data!.id}`);
}

/** Cliente: come createPickup ma ritorna l'id invece di redirezionare,
 *  così la UI multi-step può mostrare la schermata di conferma (mockup). */
export async function bookPickup(input: {
  address_id: string;
  pickup_slot_id: string;
  laundry_id: string | null;
  bags: number;
  notes?: string | null;
  recurring?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const { address_id, pickup_slot_id } = input;
  const laundry_id = input.laundry_id || null;
  const bags = Number.isFinite(input.bags) && input.bags > 0 ? input.bags : 1;
  if (!address_id || !pickup_slot_id) return { ok: false, error: "Indirizzo e slot obbligatori" };

  const [{ data: slot }, { data: sub }] = await Promise.all([
    supabase.from("slots").select("starts_at").eq("id", pickup_slot_id).maybeSingle<{ starts_at: string }>(),
    supabase
      .from("subscriptions")
      .select("status, plans(turnaround_hours)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string; plans: { turnaround_hours: number } | null }>(),
  ]);

  if (!sub || !["active", "trialing"].includes(sub.status)) {
    return { ok: false, error: "Serve un abbonamento attivo." };
  }
  const turnaround = sub?.plans?.turnaround_hours ?? 48;
  const eta = slot?.starts_at ? new Date(new Date(slot.starts_at).getTime() + turnaround * 3600_000).toISOString() : null;

  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_id: user.id,
      address_id,
      pickup_slot_id,
      laundry_id,
      eta_ready_at: eta,
      bags,
      notes: input.notes || null,
      status: "pickup_scheduled" as OrderStatus,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: slotFullMessage(error) ?? error.message };

  // Ricorrenza settimanale opzionale: salva il pattern (giorno+ora di Roma) e
  // lega l'ordine appena creato. Il cron genererà le settimane successive.
  if (input.recurring && slot?.starts_at) {
    const { data: rec } = await supabase
      .from("recurring_pickups")
      .insert({
        customer_id: user.id,
        address_id,
        weekday: romeWeekday(slot.starts_at),
        hhmm: romeHHMM(slot.starts_at),
        bags,
        notes: input.notes || null,
        active: true,
      })
      .select("id")
      .single();
    if (rec) await supabase.from("orders").update({ recurring_id: rec.id }).eq("id", data!.id);
  }

  await notifyOrderStatus(data!.id, "pickup_scheduled");
  revalidatePath("/app");
  revalidatePath("/app/ordini");
  return { ok: true, id: data!.id };
}

/** Cliente: disattiva una ricorrenza settimanale. */
export async function cancelRecurring(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("recurring_pickups").update({ active: false }).eq("id", id);
  revalidatePath("/app");
}

/** Cliente: conferma una modifica proposta dall'admin. I valori in sospeso
 *  (pending_*) diventano effettivi e la ricorrenza si attiva. */
export async function confirmRecurring(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // RLS "recpick owner": legge/aggiorna solo la propria ricorrenza.
  const { data: r } = await supabase
    .from("recurring_pickups")
    .select("pending_weekday, pending_hhmm, pending_bags, pending_delivery_hhmm")
    .eq("id", id)
    .maybeSingle<{ pending_weekday: number | null; pending_hhmm: string | null; pending_bags: number | null; pending_delivery_hhmm: string | null }>();

  const patch: Record<string, unknown> = {
    active: true,
    needs_confirmation: false,
    pending_weekday: null, pending_hhmm: null, pending_bags: null, pending_delivery_hhmm: null,
  };
  // Se c'era una proposta di modifica (ricorrenza già esistente), applica i pending.
  if (r?.pending_hhmm != null) {
    patch.weekday = r.pending_weekday;
    patch.hhmm = r.pending_hhmm;
    patch.bags = r.pending_bags;
    patch.delivery_hhmm = r.pending_delivery_hhmm;
  }
  await supabase.from("recurring_pickups").update(patch).eq("id", id);
  revalidatePath("/app");
}

/** Cliente: rifiuta una modifica proposta dall'admin. Scarta i pending; la
 *  ricorrenza resta com'era (se era nuova e mai attivata, resta disattivata). */
export async function rejectRecurring(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase
    .from("recurring_pickups")
    .update({ needs_confirmation: false, pending_weekday: null, pending_hhmm: null, pending_bags: null, pending_delivery_hhmm: null })
    .eq("id", id);
  revalidatePath("/app");
}

/** Cliente: prenota lo slot di consegna (disponibile da status=ready). */
export async function bookDelivery(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const delivery_slot_id = String(formData.get("delivery_slot_id") ?? "");
  if (!id || !delivery_slot_id) throw new Error("Slot consegna obbligatorio");

  const { error } = await supabase
    .from("orders")
    .update({ delivery_slot_id, status: "delivery_scheduled" as OrderStatus })
    .eq("id", id);
  if (error) {
    // Slot pieno o altro errore → torna alla pagina ordine con un avviso, niente pagina d'errore.
    redirect(`/app/ordini/${id}?err=${encodeURIComponent(slotFullMessage(error) ?? "Impossibile prenotare questa fascia. Riprova.")}`);
  }
  revalidatePath(`/app/ordini/${id}`);
}

/** Staff/admin: avanza lo stato dell'ordine. Il trigger DB logga l'evento. */
export async function advanceStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!id || !status) throw new Error("Parametri mancanti");

  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  await notifyOrderStatus(id, status);
  revalidatePath(`/admin/ordini/${id}`);
  revalidatePath("/admin/ordini");
  revalidatePath("/courier");
}

/** Corriere: avanza stato + opzionale nota foto prova (URL già caricato su Storage). */
export async function courierAdvance(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const proofUrl = String(formData.get("proof_url") ?? "") || null;
  if (!id || !status) throw new Error("Parametri mancanti");

  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  if (proofUrl) {
    await supabase.from("order_items").insert({ order_id: id, kind: "prova", photo_url: proofUrl });
  }
  await notifyOrderStatus(id, status);
  revalidatePath("/courier");
}

/** Rider: aggiorna la propria posizione live (mentre è in giro). RLS: solo la
 *  propria riga. Best-effort. */
export async function pingCourierLocation(lat: number, lng: number): Promise<{ ok: boolean }> {
  const me = await getCurrentProfile();
  if (!me || me.role !== "courier") return { ok: false };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false };
  const supabase = await createClient();
  await supabase.from("courier_locations").upsert(
    { courier_id: me.id, lat, lng, updated_at: new Date().toISOString() },
    { onConflict: "courier_id" },
  );
  return { ok: true };
}

/** Cliente: posizione live del rider per un proprio ordine. Ritorna la posizione
 *  SOLO se: (1) è il proprio ordine, (2) fase attiva (ritiro imminente o consegna),
 *  (3) posizione fresca (<3 min), (4) rider vicino al cliente (≤2.5 km) → "prima-
 *  ultima parte". Non espone MAI il deposito né le altre fermate. */
export async function riderLivePosition(orderId: string): Promise<RiderLivePos> {
  const me = await getCurrentProfile();
  if (!me) return null;
  const svc = createServiceClient();
  const { data: order } = await svc
    .from("orders")
    .select("id, customer_id, courier_id, status, addresses(lat, lng)")
    .eq("id", orderId)
    .maybeSingle<{ id: string; customer_id: string; courier_id: string | null; status: OrderStatus; addresses: { lat: number | null; lng: number | null } | null }>();
  if (!order || order.customer_id !== me.id || !order.courier_id) return null;
  if (!["pickup_scheduled", "out_for_delivery"].includes(order.status)) return null;

  const custLat = order.addresses?.lat, custLng = order.addresses?.lng;
  if (custLat == null || custLng == null) return null;

  const { data: loc } = await svc
    .from("courier_locations")
    .select("lat, lng, updated_at")
    .eq("courier_id", order.courier_id)
    .maybeSingle<{ lat: number; lng: number; updated_at: string }>();
  if (!loc) return null;
  if (Date.now() - Date.parse(loc.updated_at) > 3 * 60 * 1000) return null; // posizione stantia
  if (haversineKm(loc.lat, loc.lng, custLat, custLng) > 2.5) return null;    // non ancora vicino

  const label = order.status === "out_for_delivery" ? "Il rider è in consegna" : "Il rider sta arrivando per il ritiro";
  return { lat: loc.lat, lng: loc.lng, label, custLat, custLng };
}

/** Rider: scansiona il QR sulla borsa (= client_code). La modalità è dedotta dallo
 *  stato dell'ordine: RITIRO (pickup_scheduled) o CONSEGNA (delivery_scheduled/
 *  out_for_delivery). Ogni scan al ritiro crea un pacco univoco (token); alla
 *  consegna marca il prossimo pacco. A completamento avanza lo stato + notifica. */
export async function scanBag(clientCodeRaw: string): Promise<ScanResult> {
  const me = await getCurrentProfile();
  if (!me || me.role !== "courier") return { ok: false, error: "Solo rider" };

  // Il QR può contenere il codice puro o un URL che lo termina: estrai WL-####.
  const raw = (clientCodeRaw ?? "").trim();
  const m = raw.match(/WL-\d{3,}/i);
  const clientCode = (m ? m[0] : raw).toUpperCase();
  if (!/^WL-\d{3,}$/.test(clientCode)) return { ok: false, error: "QR non valido (atteso codice WL-…)" };

  const svc = createServiceClient();
  const { data: prof } = await svc.from("profiles").select("id, full_name").eq("client_code", clientCode).maybeSingle<{ id: string; full_name: string | null }>();
  if (!prof) return { ok: false, error: `Cliente ${clientCode} non trovato` };

  const { data: orders } = await svc
    .from("orders")
    .select("id, status, bags, created_at")
    .eq("customer_id", prof.id)
    .eq("courier_id", me.id)
    .in("status", ["pickup_scheduled", "delivery_scheduled", "out_for_delivery"])
    .order("created_at", { ascending: true })
    .returns<{ id: string; status: OrderStatus; bags: number; created_at: string }[]>();
  const order = (orders ?? [])[0];
  if (!order) return { ok: false, error: "Nessun ordine attivo per questo cliente nel tuo giro" };

  const client = prof.full_name ?? clientCode;
  const mode: "pickup" | "delivery" = order.status === "pickup_scheduled" ? "pickup" : "delivery";

  const { data: bagsRows } = await svc
    .from("order_bags")
    .select("id, seq, pickup_scanned_at, delivery_scanned_at")
    .eq("order_id", order.id)
    .order("seq", { ascending: true })
    .returns<{ id: string; seq: number; pickup_scanned_at: string | null; delivery_scanned_at: string | null }[]>();
  const list = bagsRows ?? [];

  if (mode === "pickup") {
    const total = order.bags ?? 1;
    if (list.length >= total) return { ok: false, error: `Tutti i ${total} pacchi già ritirati per ${client}` };
    const seq = list.length + 1;
    const token = `WLB-${crypto.randomBytes(5).toString("hex")}`;
    const { error } = await svc.from("order_bags").insert({
      order_id: order.id, seq, token,
      pickup_scanned_at: new Date().toISOString(), pickup_by: me.id,
    });
    if (error) return { ok: false, error: error.message };
    const done = seq >= total;
    if (done) {
      await svc.from("orders").update({ status: "picked_up" }).eq("id", order.id);
      await notifyOrderStatus(order.id, "picked_up");
    }
    revalidatePath("/courier");
    return { ok: true, mode, seq, total, done, client, token };
  }

  // CONSEGNA: marca il prossimo pacco non consegnato.
  if (list.length === 0) return { ok: false, error: "Nessun pacco registrato al ritiro: usa il bottone manuale" };
  const next = list.find((b) => !b.delivery_scanned_at);
  const total = list.length;
  if (!next) return { ok: false, error: `Tutti i ${total} pacchi già consegnati a ${client}` };

  await svc.from("order_bags").update({ delivery_scanned_at: new Date().toISOString(), delivery_by: me.id }).eq("id", next.id);
  if (order.status === "delivery_scheduled") await svc.from("orders").update({ status: "out_for_delivery" }).eq("id", order.id);
  const delivered = list.filter((b) => b.delivery_scanned_at).length + 1;
  const done = delivered >= total;
  if (done) {
    await svc.from("orders").update({ status: "delivered" }).eq("id", order.id);
    await notifyOrderStatus(order.id, "delivered");
  }
  revalidatePath("/courier");
  return { ok: true, mode, seq: delivered, total, done, client };
}

/** Admin: assegna corriere e lavanderia. */
export async function assignOrder(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const courier_id = String(formData.get("courier_id") ?? "") || null;
  const laundry_id = String(formData.get("laundry_id") ?? "") || null;

  const { error } = await supabase.from("orders").update({ courier_id, laundry_id }).eq("id", id);
  if (error) throw new Error(error.message);
  if (courier_id) await notifyCourierAssigned(id);
  revalidatePath(`/admin/ordini/${id}`);
}

/** Assegna solo il rider (preserva la lavanderia). Per azione rapida dal board. */
export async function assignCourier(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const courier_id = String(formData.get("courier_id") ?? "") || null;
  const { error } = await supabase.from("orders").update({ courier_id }).eq("id", id);
  if (error) throw new Error(error.message);
  if (courier_id) await notifyCourierAssigned(id);
  revalidatePath("/admin/ordini");
  revalidatePath(`/admin/ordini/${id}`);
}

/** Admin: assegna automaticamente TUTTI gli ordini da assegnare ai corrieri.
 *  Priorità 1 — rider della ZONA: se la zona dell'indirizzo ha un rider dedicato
 *  (zones.courier_id), l'ordine va a lui. Priorità 2 — fallback bilanciato: zone
 *  senza rider (o rider non disponibile) → corriere meno carico. Copre lo scenario
 *  2-3 rider con alcune zone condivise. Nessuna ottimizzazione geografica del giro. */
export async function autoAssignCouriers() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const supabase = await createClient();

  const NEEDS: OrderStatus[] = ["requested", "pickup_scheduled", "ready", "delivery_scheduled"];
  const ACTIVE: OrderStatus[] = ["requested", "pickup_scheduled", "picked_up", "at_laundry", "washing", "ready", "delivery_scheduled", "out_for_delivery"];

  type Todo = {
    id: string; laundry_id: string | null;
    pickup_slot: { starts_at: string } | null; delivery_slot: { starts_at: string } | null;
    addresses: { zone_id: string | null; zones: { courier_id: string | null } | null } | null;
  };
  const [{ data: unassigned }, { data: couriers }, { data: assigned }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, laundry_id, pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at), addresses(zone_id, zones(courier_id))")
      .is("courier_id", null)
      .in("status", NEEDS)
      .returns<Todo[]>(),
    supabase.from("profiles").select("id").eq("role", "courier").returns<{ id: string }[]>(),
    supabase.from("orders").select("courier_id").not("courier_id", "is", null).in("status", ACTIVE).returns<{ courier_id: string | null }[]>(),
  ]);

  const courierIds = (couriers ?? []).map((c) => c.id);
  if (courierIds.length === 0) redirect(`/admin/ordini?warn=${encodeURIComponent("Nessun corriere disponibile: creane uno prima.")}`);
  const todo = unassigned ?? [];
  if (todo.length === 0) redirect(`/admin/ordini?ok=${encodeURIComponent("Nessun ordine da assegnare.")}`);

  // Carico attuale = fermate attive già assegnate per corriere.
  const load = new Map<string, number>(courierIds.map((id) => [id, 0]));
  for (const a of assigned ?? []) if (a.courier_id && load.has(a.courier_id)) load.set(a.courier_id, (load.get(a.courier_id) ?? 0) + 1);

  // Ordina per lavanderia + orario slot (raggruppa lo stesso giro).
  const slotAt = (o: Todo) => o.delivery_slot?.starts_at ?? o.pickup_slot?.starts_at ?? "";
  const sorted = [...todo].sort((a, b) => (a.laundry_id ?? "").localeCompare(b.laundry_id ?? "") || slotAt(a).localeCompare(slotAt(b)));

  let byZone = 0, byBalance = 0;
  const byCourier = new Map<string, string[]>();
  for (const o of sorted) {
    // 1) rider della zona, se impostato e disponibile.
    const zoneCourier = o.addresses?.zones?.courier_id ?? null;
    let best: string;
    if (zoneCourier && load.has(zoneCourier)) {
      best = zoneCourier; byZone++;
    } else {
      // 2) fallback: corriere meno carico.
      best = courierIds[0];
      for (const id of courierIds) if ((load.get(id) ?? 0) < (load.get(best) ?? 0)) best = id;
      byBalance++;
    }
    load.set(best, (load.get(best) ?? 0) + 1);
    (byCourier.get(best) ?? byCourier.set(best, []).get(best)!).push(o.id);
  }

  // Applica gli update (uno per corriere) + notifica i rider (best-effort).
  const assignedIds: string[] = [];
  for (const [courierId, ids] of byCourier) {
    if (ids.length === 0) continue;
    await supabase.from("orders").update({ courier_id: courierId }).in("id", ids);
    assignedIds.push(...ids);
  }
  await Promise.all(assignedIds.map((id) => notifyCourierAssigned(id)));

  revalidatePath("/admin/ordini");
  redirect(`/admin/ordini?ok=${encodeURIComponent(`${assignedIds.length} ordini assegnati a ${byCourier.size} rider (${byZone} per zona, ${byBalance} bilanciati).`)}`);
}

/** Assegna lo stesso rider a più ordini (assegnazione massiva). */
export async function bulkAssignCourier(formData: FormData) {
  const supabase = await createClient();
  const ids = String(formData.get("order_ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const courier_id = String(formData.get("courier_id") ?? "") || null;
  if (ids.length === 0 || !courier_id) throw new Error("Seleziona ordini e rider");

  const { error } = await supabase.from("orders").update({ courier_id }).in("id", ids);
  if (error) throw new Error(error.message);
  await Promise.all(ids.map((id) => notifyCourierAssigned(id)));
  revalidatePath("/admin/ordini");
}

/** Lavanderia/admin: imposta o affina la data "pronto" (ETA). */
export async function setEta(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("order_id") ?? "");
  const raw = String(formData.get("eta_ready_at") ?? "");
  const eta = romeLocalToISO(raw);

  const { error } = await supabase.from("orders").update({ eta_ready_at: eta }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/ordini/${id}`);
  revalidatePath(`/app/ordini/${id}`);
}
