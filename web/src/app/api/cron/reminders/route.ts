import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyPromemoria } from "@/lib/notify";
import { fmtSlot } from "@/lib/format";

/** Cron della sera: avvisa chi domani ha un ritiro o una riconsegna.
 *
 *  Serve a non fare passaggi a vuoto: il rider arriva, il sacco non c'è, e la
 *  tappa è persa lo stesso. Gira una volta al giorno alle 18:00 italiane
 *  (vercel.json usa UTC, quindi 16:00).
 *
 *  Idempotente: ogni ordine avvisato viene marcato con `pickup_reminder_at` /
 *  `delivery_reminder_at`, così un secondo lancio — a mano, o un retry della
 *  piattaforma — non manda una seconda email allo stesso cliente. */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Slot = { starts_at: string; ends_at: string };
type Riga = {
  id: string;
  bags: number | null;
  customer_id: string | null;
  status: string;
  pickup_slot: Slot | Slot[] | null;
  delivery_slot: Slot | Slot[] | null;
};

/** L'embed PostgREST arriva come array anche per una relazione uno-a-uno. */
const uno = (v: Slot | Slot[] | null): Slot | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Estremi di "domani" in ora di Roma, espressi in ISO/UTC. Calcolati dal
 *  giorno civile italiano e non da `now + 24h`: alle 18:00 un +24h finirebbe
 *  alle 18:00 di domani, tagliando fuori le fasce del mattino. */
function domaniRoma(): { da: string; a: string } {
  const oggiRoma = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const inizio = new Date(`${oggiRoma}T00:00:00Z`);
  const da = new Date(inizio.getTime() + 86_400_000);
  const a = new Date(inizio.getTime() + 2 * 86_400_000);
  return { da: da.toISOString(), a: a.toISOString() };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "supabase env mancante" }, { status: 500 });
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { da, a } = domaniRoma();

  // `!inner` è indispensabile: senza, il filtro su una colonna dell'embed
  // filtrerebbe solo l'embed e lascerebbe passare tutti gli ordini padre con lo
  // slot a null — cioè un promemoria a chiunque abbia un ordine aperto.
  const selRitiri =
    "id, bags, customer_id, status, pickup_slot:slots!orders_pickup_slot_id_fkey!inner(starts_at, ends_at), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at)";
  const selConsegne =
    "id, bags, customer_id, status, pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at), delivery_slot:slots!orders_delivery_slot_id_fkey!inner(starts_at, ends_at)";

  const [ritiri, consegne] = await Promise.all([
    sb
      .from("orders")
      .select(selRitiri)
      .eq("status", "pickup_scheduled")
      .is("pickup_reminder_at", null)
      .gte("pickup_slot.starts_at", da)
      .lt("pickup_slot.starts_at", a)
      .returns<Riga[]>(),
    sb
      .from("orders")
      .select(selConsegne)
      .eq("status", "delivery_scheduled")
      .is("delivery_reminder_at", null)
      .gte("delivery_slot.starts_at", da)
      .lt("delivery_slot.starts_at", a)
      .returns<Riga[]>(),
  ]);

  let inviati = 0;
  const errori: string[] = [];

  for (const o of ritiri.data ?? []) {
    const s = uno(o.pickup_slot);
    if (!s || !o.customer_id) continue;
    await notifyPromemoria(o.customer_id, {
      tipo: "ritiro",
      fascia: fmtSlot(s.starts_at, s.ends_at),
      orderId: o.id,
      bags: o.bags ?? 1,
    });
    const { error } = await sb.from("orders").update({ pickup_reminder_at: new Date().toISOString() }).eq("id", o.id);
    if (error) errori.push(`${o.id}: ${error.message}`);
    inviati++;
  }

  for (const o of consegne.data ?? []) {
    const s = uno(o.delivery_slot);
    if (!s || !o.customer_id) continue;
    await notifyPromemoria(o.customer_id, {
      tipo: "consegna",
      fascia: fmtSlot(s.starts_at, s.ends_at),
      orderId: o.id,
      bags: o.bags ?? 1,
    });
    const { error } = await sb.from("orders").update({ delivery_reminder_at: new Date().toISOString() }).eq("id", o.id);
    if (error) errori.push(`${o.id}: ${error.message}`);
    inviati++;
  }

  if (ritiri.error || consegne.error) {
    console.error("[cron/reminders] query fallita:", ritiri.error ?? consegne.error);
    return NextResponse.json({ ok: false, error: (ritiri.error ?? consegne.error)?.message }, { status: 500 });
  }
  if (errori.length) console.error("[cron/reminders] marcature fallite:", errori);

  return NextResponse.json({
    ok: true,
    finestra: { da, a },
    ritiri: ritiri.data?.length ?? 0,
    consegne: consegne.data?.length ?? 0,
    inviati,
  });
}
