"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { romeLocalToISO } from "@/lib/format";
import { geocodeAddress } from "@/lib/geo";
import { zoneIdForCap } from "@/lib/zones";

/** Verifica che a chiamare sia un amministratore.
 *
 *  Le regole del database già bloccano queste scritture — le tabelle di
 *  configurazione accettano solo `is_admin()` — ma una server action è
 *  raggiungibile da chiunque abbia una sessione, non solo da chi vede il
 *  pannello. Senza questo controllo la difesa era una sola, e chi provava si
 *  prendeva un errore incomprensibile del database invece di un rifiuto
 *  chiaro. Stessa guardia che avevano già `deleteLaundry`, `updateDepot` e le
 *  altre: queste erano rimaste indietro. */
async function soloAdmin() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  return me;
}

const REV = "/admin/catalogo";

// ---------- ZONE ----------
export async function createZone(formData: FormData) {
  await soloAdmin();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome zona obbligatorio");
  const { error } = await supabase.from("zones").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function toggleZone(formData: FormData) {
  await soloAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const { error } = await supabase.from("zones").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function deleteZone(formData: FormData) {
  await soloAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("zones").delete().eq("id", id);
  if (error) throw new Error("Zona in uso, non eliminabile. Disattivala invece.");
  revalidatePath(REV);
}

/** Backfill coordinate + zona per gli indirizzi esistenti (senza lat/lng). Geocoding
 *  Nominatim: max ~1 req/s → processa un blocco alla volta (default 15) con pausa.
 *  Riesegui il pulsante finché non resta nulla. Solo admin. */
export async function backfillGeocode() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const svc = createServiceClient();

  const { data: rows } = await svc
    .from("addresses")
    .select("id, street, cap, civico")
    .is("lat", null)
    .limit(15)
    .returns<{ id: string; street: string; cap: string | null; civico: string | null }[]>();

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (const a of rows ?? []) {
    // CAP: colonna dedicata o estratto dalla street.
    const cap = a.cap ?? (a.street.match(/(\d{5})/)?.[1] ?? null);
    const geo = await geocodeAddress({ street: a.street, cap, city: "Milano" });
    const zoneId = await zoneIdForCap(svc, cap);
    const patch: Record<string, unknown> = {};
    if (geo) { patch.lat = geo.lat; patch.lng = geo.lng; }
    if (cap && !a.cap) patch.cap = cap;
    if (zoneId) patch.zone_id = zoneId;
    if (Object.keys(patch).length) await svc.from("addresses").update(patch).eq("id", a.id);
    await sleep(1100); // rispetta la policy Nominatim
  }
  revalidatePath(REV);
}

/** Assegna (o rimuove) il rider dedicato di una zona. L'auto-assegnazione ordini
 *  manda alla zona il suo rider; le zone senza rider usano il fallback bilanciato. */
export async function setZoneCourier(formData: FormData) {
  await soloAdmin();
  const supabase = await createClient();
  const id = String(formData.get("zone_id") ?? "");
  const courier_id = String(formData.get("courier_id") ?? "") || null;
  const { error } = await supabase.from("zones").update({ courier_id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

// ---------- DEPOSITO (hub logistico interno) ----------
export async function updateDepot(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const svc = createServiceClient();
  const id = String(formData.get("depot_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim() || "Deposito Milano";
  const address = String(formData.get("address") ?? "").trim() || null;
  const geo = address ? await geocodeAddress({ street: address, city: "Milano" }) : null;
  const patch = { name, address, lat: geo?.lat ?? null, lng: geo?.lng ?? null, active: true };
  if (id) await svc.from("depots").update(patch).eq("id", id);
  else await svc.from("depots").insert(patch);
  revalidatePath(REV);
}

// ---------- LAVANDERIE ----------
export async function createLaundry(formData: FormData) {
  await soloAdmin();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome lavanderia obbligatorio");
  const address = String(formData.get("address") ?? "") || null;
  const geo = address ? await geocodeAddress({ street: address, city: "Milano" }) : null;
  const { error } = await supabase.from("laundries").insert({
    name,
    zone_id: String(formData.get("zone_id") ?? "") || null,
    address,
    phone: String(formData.get("phone") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function updateLaundry(formData: FormData) {
  await soloAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("Dati lavanderia mancanti");
  const address = String(formData.get("address") ?? "") || null;
  // Geocodifica l'indirizzo (deposito) al salvataggio, best-effort.
  const geo = address ? await geocodeAddress({ street: address, city: "Milano" }) : null;
  const patch: Record<string, unknown> = {
    name,
    zone_id: String(formData.get("zone_id") ?? "") || null,
    address,
    phone: String(formData.get("phone") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    active: formData.has("active"),
  };

  // Compenso per sacco: arriva in euro dal form, in DB sta in centesimi. È il
  // numero da cui dipende tutto il "da dare", e finora non era modificabile.
  const compEuro = String(formData.get("bag_comp_eur") ?? "").trim().replace(",", ".");
  if (compEuro !== "") {
    const cents = Math.round(parseFloat(compEuro) * 100);
    if (Number.isFinite(cents) && cents >= 0) patch.bag_comp_cents = cents;
  }
  if (geo) { patch.lat = geo.lat; patch.lng = geo.lng; }
  else if (!address) { patch.lat = null; patch.lng = null; }
  const { error } = await supabase.from("laundries").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

/** Elimina DEFINITIVAMENTE una lavanderia. Prima scollega gli ordini
 *  (laundry_id → null) e rimuove i suoi slot, così l'eliminazione va a buon fine
 *  anche se ci sono riferimenti. I payout collegati vanno in cascade; i profili
 *  partner vengono scollegati (FK on delete set null). Solo admin. */
export async function deleteLaundry(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Lavanderia mancante");
  const svc = createServiceClient();

  // Scollega gli ordini dalla lavanderia. Poi, per poter rimuovere gli slot,
  // azzera i riferimenti degli ordini agli slot di questa lavanderia (FK).
  await svc.from("orders").update({ laundry_id: null }).eq("laundry_id", id);
  const { data: slotRows } = await svc.from("slots").select("id").eq("laundry_id", id).returns<{ id: string }[]>();
  const slotIds = (slotRows ?? []).map((s) => s.id);
  if (slotIds.length) {
    await svc.from("orders").update({ pickup_slot_id: null }).in("pickup_slot_id", slotIds);
    await svc.from("orders").update({ delivery_slot_id: null }).in("delivery_slot_id", slotIds);
    await svc.from("slots").delete().in("id", slotIds);
  }

  const { error } = await svc.from("laundries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

// ---------- PIANI ----------
export async function updatePlanPrice(formData: FormData) {
  await soloAdmin();
  const supabase = await createClient();
  const id = String(formData.get("plan_id") ?? "");
  const stripe_price_id = String(formData.get("stripe_price_id") ?? "").trim() || null;
  const { error } = await supabase.from("plans").update({ stripe_price_id }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function updatePlan(formData: FormData) {
  await soloAdmin();
  const supabase = await createClient();
  const id = String(formData.get("plan_id") ?? "");
  const euro = Number(formData.get("price_eur") ?? 0);
  const { error } = await supabase
    .from("plans")
    .update({
      name: String(formData.get("name") ?? "").trim() || "Piano",
      price_month_cents: Number.isFinite(euro) ? Math.round(euro * 100) : 0,
      turnaround_hours: Number(formData.get("turnaround_hours") ?? 48) || 48,
      pickups_per_week: Number(formData.get("pickups_per_week") ?? 1) || 1,
      active: formData.has("active"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

// ---------- SLOT ----------
export async function createSlot(formData: FormData) {
  await soloAdmin();
  const supabase = await createClient();
  const date = String(formData.get("date") ?? "");
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!date || !from || !to) throw new Error("Data e orari obbligatori");

  const { error } = await supabase.from("slots").insert({
    zone_id: String(formData.get("zone_id") ?? "") || null,
    laundry_id: String(formData.get("laundry_id") ?? "") || null,
    kind: String(formData.get("kind") ?? "pickup"),
    starts_at: romeLocalToISO(`${date}T${from}`),
    ends_at: romeLocalToISO(`${date}T${to}`),
    capacity: Number(formData.get("capacity") ?? 10) || 10,
  });
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}

export async function deleteSlot(formData: FormData) {
  await soloAdmin();
  const id = String(formData.get("slot_id") ?? "");
  if (!id) redirect(`${REV}?warn=${encodeURIComponent("Fascia non trovata.")}`);

  // Si archivia, non si cancella. La riga resta dov'è, quindi gli ordini che ci
  // puntano continuano a sapere giorno e ora — è il requisito: «le richieste
  // dei clienti devono rimanere anche se cancello tutto». Dal calendario e
  // dalla prenotazione la fascia sparisce comunque.
  //
  // Prima si tentava una DELETE vera, che sulle fasce occupate il database
  // rifiutava: le uniche che non riuscivi a togliere erano proprio quelle che
  // ti davano fastidio.
  const svc = createServiceClient();
  const { count } = await svc
    .from("orders")
    .select("id", { count: "exact", head: true })
    .or(`pickup_slot_id.eq.${id},delivery_slot_id.eq.${id}`)
    .neq("status", "cancelled");

  const { error } = await svc.from("slots").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`${REV}?warn=${encodeURIComponent(`Fascia non archiviata: ${error.message}`)}`);

  revalidatePath(REV);
  const coda = (count ?? 0) > 0
    ? ` I ${count} ordini già prenotati su quella fascia restano validi, con il loro orario.`
    : "";
  redirect(`${REV}?ok=${encodeURIComponent(`Fascia tolta dal calendario.${coda}`)}`);
}

/** Toglie dal calendario tutte le fasce future di una lavanderia.
 *
 *  Ora archivia, quindi **non salta più quelle occupate**: prima le lasciava
 *  indietro per non lasciare un ordine senza orario, e chi premeva vedeva
 *  restare proprio le fasce che voleva togliere — sembrava rotto mentre stava
 *  facendo il suo lavoro. Archiviando il problema non esiste: la riga resta,
 *  l'ordine tiene giorno e ora, il calendario si pulisce davvero. */
export async function deleteFutureSlots(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const laundry_id = String(formData.get("laundry_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!laundry_id || !["pickup", "delivery"].includes(kind)) {
    redirect(`${REV}?warn=${encodeURIComponent("Scegli la lavanderia e il tipo di fascia.")}`);
  }

  const svc = createServiceClient();
  const { data: futuri } = await svc
    .from("slots")
    .select("id")
    .eq("laundry_id", laundry_id)
    .eq("kind", kind)
    .is("archived_at", null)
    .gte("starts_at", new Date().toISOString())
    .returns<{ id: string }[]>();

  const ids = (futuri ?? []).map((s) => s.id);
  if (ids.length === 0) redirect(`${REV}?ok=${encodeURIComponent("Nessuna fascia futura da togliere.")}`);

  const col = kind === "pickup" ? "pickup_slot_id" : "delivery_slot_id";
  const { count: conOrdini } = await svc
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in(col, ids)
    .neq("status", "cancelled");

  const { error } = await svc.from("slots").update({ archived_at: new Date().toISOString() }).in("id", ids);
  if (error) redirect(`${REV}?warn=${encodeURIComponent(error.message)}`);

  revalidatePath(REV);
  const coda = (conOrdini ?? 0) > 0
    ? ` ${conOrdini} ${conOrdini === 1 ? "ordine resta valido" : "ordini restano validi"}, con il loro orario.`
    : "";
  redirect(`${REV}?ok=${encodeURIComponent(`${ids.length} fasce tolte dal calendario.${coda}`)}`);
}

export async function generateSlots(formData: FormData) {
  await soloAdmin();
  const supabase = await createClient();
  const laundry_id = String(formData.get("laundry_id") ?? "");
  if (!laundry_id) throw new Error("Lavanderia obbligatoria");
  const kind = String(formData.get("kind") ?? "pickup");
  const date_from = String(formData.get("date_from") ?? "");
  const date_to = String(formData.get("date_to") ?? "");
  const capacity = Number(formData.get("capacity") ?? 10) || 10;
  const days = formData.getAll("days").map(String);
  const windows = [
    [String(formData.get("w1_from") ?? ""), String(formData.get("w1_to") ?? "")],
    [String(formData.get("w2_from") ?? ""), String(formData.get("w2_to") ?? "")],
  ].filter(([a, b]) => a && b);

  if (!date_from || !date_to || days.length === 0) throw new Error("Date e giorni obbligatori");
  if (windows.length === 0) throw new Error("Inserisci almeno una fascia oraria");

  const { data: lab } = await supabase.from("laundries").select("zone_id").eq("id", laundry_id).maybeSingle<{ zone_id: string | null }>();
  const zone_id = lab?.zone_id ?? null;

  const start = new Date(`${date_from}T00:00:00Z`);
  const end = new Date(`${date_to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) throw new Error("Intervallo date non valido");

  const rows: Array<Record<string, unknown>> = [];
  const d = new Date(start);
  for (let i = 0; d <= end && i < 90; d.setUTCDate(d.getUTCDate() + 1), i++) {
    if (!days.includes(String(d.getUTCDay()))) continue;
    const ds = d.toISOString().slice(0, 10);
    for (const [from, to] of windows) {
      rows.push({ laundry_id, zone_id, kind, starts_at: romeLocalToISO(`${ds}T${from}`), ends_at: romeLocalToISO(`${ds}T${to}`), capacity });
    }
  }
  if (rows.length === 0) throw new Error("Nessuno slot da creare con questi criteri");
  if (rows.length > 500) throw new Error("Troppi slot: riduci l'intervallo o le fasce");

  const { error } = await supabase.from("slots").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath(REV);
}
