"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/orders";
import { romeLocalToISO, romeWeekday, romeHHMM } from "@/lib/format";
import { notifyOrderStatus, notifyCourierAssigned } from "@/lib/notify";

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
  if (error) throw new Error(error.message);

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
  if (error) return { ok: false, error: error.message };

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
  if (error) throw new Error(error.message);
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
  revalidatePath("/admin");
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
  revalidatePath("/admin");
  revalidatePath(`/admin/ordini/${id}`);
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
  revalidatePath("/admin");
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
