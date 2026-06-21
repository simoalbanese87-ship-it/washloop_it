import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { romeWeekday, romeHHMM } from "@/lib/format";

/** Cron giornaliero: genera gli ordini delle ricorrenze settimanali attive,
 *  agganciandoli a uno slot reale con stesso giorno+ora (Europe/Rome) nei
 *  prossimi giorni. Idempotente: non duplica se l'ordine esiste già. */

export const dynamic = "force-dynamic";
const LOOKAHEAD_DAYS = 4;

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

  const now = new Date();
  const until = new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000);

  const [{ data: recs }, { data: slots }] = await Promise.all([
    sb.from("recurring_pickups").select("id, customer_id, address_id, weekday, hhmm, bags, notes").eq("active", true),
    sb.from("slots").select("id, starts_at, laundry_id").eq("kind", "pickup").gte("starts_at", now.toISOString()).lte("starts_at", until.toISOString()),
  ]);

  let created = 0;
  const turnaroundCache = new Map<string, number>();

  for (const rec of recs ?? []) {
    const matches = (slots ?? []).filter((s) => romeWeekday(s.starts_at) === rec.weekday && romeHHMM(s.starts_at) === rec.hhmm);
    if (matches.length === 0) continue;

    // Sub attivo + turnaround del cliente (cache per cliente)
    let turnaround = turnaroundCache.get(rec.customer_id) ?? -1;
    if (turnaround === -1) {
      const { data: sub } = await sb
        .from("subscriptions")
        .select("status, plans(turnaround_hours)")
        .eq("user_id", rec.customer_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ status: string; plans: { turnaround_hours: number } | null }>();
      turnaround = sub && ["active", "trialing"].includes(sub.status) ? (sub.plans?.turnaround_hours ?? 48) : 0;
      turnaroundCache.set(rec.customer_id, turnaround);
    }
    if (turnaround === 0) continue; // abbonamento non attivo → niente generazione

    for (const slot of matches) {
      const { data: existing } = await sb
        .from("orders")
        .select("id")
        .eq("recurring_id", rec.id)
        .eq("pickup_slot_id", slot.id)
        .maybeSingle();
      if (existing) continue;

      const eta = new Date(new Date(slot.starts_at).getTime() + turnaround * 3600_000).toISOString();
      const { error } = await sb.from("orders").insert({
        customer_id: rec.customer_id,
        address_id: rec.address_id,
        pickup_slot_id: slot.id,
        laundry_id: slot.laundry_id,
        eta_ready_at: eta,
        bags: rec.bags,
        notes: rec.notes,
        status: "pickup_scheduled",
        recurring_id: rec.id,
      });
      if (!error) created++;
    }
  }

  return NextResponse.json({ ok: true, recurrences: recs?.length ?? 0, slots: slots?.length ?? 0, created });
}
