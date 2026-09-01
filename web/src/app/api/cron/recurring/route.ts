import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { romeWeekday, romeHHMM } from "@/lib/format";
import { notifyOrderStatus } from "@/lib/notify";
import { registraGuasto } from "@/lib/incidenti";

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

  // `createServiceClient()` e non un client costruito qui: la chiave nelle env
  // contiene spazi e un a capo, e passata grezza fa fallire `Headers.set` prima
  // ancora della richiesta. La libreria condivisa la ripulisce da sempre; questi
  // due cron se la costruivano per conto loro ed erano gli unici a non farlo.
  // Risultato: non hanno MAI funzionato — zero promemoria inviati su 11 ordini e
  // zero ordini generati dalle ricorrenze attive — e si è scoperto solo quando
  // il registro dei guasti ha iniziato a raccogliere gli errori.
  const sb = createServiceClient();

  const now = new Date();
  const until = new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000);

  const [{ data: recs }, { data: slots }, { data: deliverySlots }] = await Promise.all([
    sb.from("recurring_pickups").select("id, customer_id, address_id, weekday, hhmm, delivery_hhmm, bags, notes").eq("active", true),
    sb.from("slots").select("id, starts_at, laundry_id, capacity").eq("kind", "pickup").gte("starts_at", now.toISOString()).lte("starts_at", until.toISOString()),
    // Fasce di riconsegna: si guarda più avanti dei ritiri, perché la
    // riconsegna cade dopo la lavorazione (48h, o 24h sui piani veloci).
    sb.from("slots").select("id, starts_at, laundry_id, capacity").eq("kind", "delivery").gte("starts_at", now.toISOString()).lte("starts_at", new Date(until.getTime() + 4 * 86_400_000).toISOString()),
  ]);

  let created = 0;
  let skippedFull = 0;
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
      // Doppione = stessa PERSONA nella stessa fascia, non stessa ricorrenza.
      //
      // Il controllo guardava `recurring_id`, e bastava un ritiro prenotato a
      // mano per non essere visto: il 1° settembre Saverio si era prenotato da
      // solo per le 09:00 del martedì, il cron alle 08:04 non ha riconosciuto
      // quell'ordine come suo e gliene ha creato un secondo nella stessa fascia.
      // Due ritiri per la stessa persona alla stessa ora, uno dei quali non lo
      // farà mai nessuno — e intanto occupa un posto nello slot.
      //
      // Nessuno ha due ritiri contemporanei, quindi la chiave giusta è
      // cliente + fascia. Copre anche il caso opposto: ricorrenza rifatta da
      // capo (nuovo `recurring_id`) sulla stessa fascia di prima.
      const { data: existing } = await sb
        .from("orders")
        .select("id")
        .eq("customer_id", rec.customer_id)
        .eq("pickup_slot_id", slot.id)
        .neq("status", "cancelled")
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      // Rispetta la capacità dello slot: se è pieno, salta (il trigger DB
      // bloccherebbe comunque l'insert, qui evitiamo l'eccezione).
      if (slot.capacity != null) {
        const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("pickup_slot_id", slot.id).neq("status", "cancelled");
        if ((count ?? 0) >= slot.capacity) { skippedFull++; continue; }
      }

      const eta = new Date(new Date(slot.starts_at).getTime() + turnaround * 3600_000).toISOString();

      // La fascia di riconsegna preferita, onorata quando esiste davvero:
      // primo slot delivery all'ora richiesta e non prima che il bucato sia
      // pronto. Se non c'è, l'ordine nasce senza e la programma l'ops — come
      // succedeva a tutti prima che la scelta esistesse.
      let deliverySlotId: string | null = null;
      if (rec.delivery_hhmm) {
        const candidato = (deliverySlots ?? [])
          .filter((d) => romeHHMM(d.starts_at) === rec.delivery_hhmm && d.starts_at >= eta)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
        if (candidato) {
          const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("delivery_slot_id", candidato.id).neq("status", "cancelled");
          if (candidato.capacity == null || (count ?? 0) < candidato.capacity) deliverySlotId = candidato.id;
        }
      }

      const { data: ins, error } = await sb.from("orders").insert({
        customer_id: rec.customer_id,
        address_id: rec.address_id,
        pickup_slot_id: slot.id,
        delivery_slot_id: deliverySlotId,
        laundry_id: slot.laundry_id,
        eta_ready_at: eta,
        bags: rec.bags,
        notes: rec.notes,
        status: "pickup_scheduled",
        recurring_id: rec.id,
      }).select("id").single();
      if (!error && ins) {
        created++;
        await notifyOrderStatus(ins.id, "pickup_scheduled"); // email+push cliente + heads-up lavanderia
      } else if (error) {
        // Prima finiva qui, in silenzio: il ritiro settimanale del cliente non
        // veniva creato e non lo sapeva nessuno, né lui né noi.
        await registraGuasto("cron", `Ricorrenza non generata: ${error.message}`, { recurring_id: rec.id, slot_id: slot.id });
      }
    }
  }

  return NextResponse.json({ ok: true, recurrences: recs?.length ?? 0, slots: slots?.length ?? 0, created, skippedFull });
}
