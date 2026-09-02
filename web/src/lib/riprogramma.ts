import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { deliveryCounts } from "@/lib/slots";
import { scegliRiconsegna, nuovaEta, type EsitoRiconsegna, type Fascia } from "@/lib/ritardo";
import { RITARDO_MASSIMO_GIORNI } from "@/lib/segnalazioni";
import { fmtSlot } from "@/lib/format";

/** Sposta la riconsegna di un ordine quando il bucato non sarà pronto in tempo.
 *
 *  La decisione — quale fascia — sta in `lib/ritardo.ts`, che è puro e testato.
 *  Qui c'è solo il contorno: leggere il mondo, chiamare la regola, scrivere il
 *  risultato. Separati apposta: la parte che decide una data che una persona
 *  aspetta a casa deve essere collaudabile senza database.
 */

export type Riprogrammazione = EsitoRiconsegna & {
  /** Fascia promessa prima. Serve a raccontare lo spostamento («dal 4 al 9»). */
  slotPrecedente: string | null;
  /** Inizio della fascia nuova, ISO. Per i messaggi. */
  quandoNuova: string | null;
};

/** Applica un ritardo dichiarato dalla lavanderia su un ordine.
 *
 *  - allunga `eta_ready_at` se serve (non lo accorcia mai);
 *  - sceglie la riconsegna secondo la regola;
 *  - scrive `delivery_slot_id` solo se cambia davvero.
 *
 *  Non notifica nessuno: l'avviso lo manda chi chiama, in un messaggio solo
 *  insieme al motivo del ritardo. Due email — «c'è una macchia» e poi «la
 *  consegna è spostata» — sono la stessa notizia detta due volte. */
export async function riprogrammaPerRitardo(
  orderId: string,
  prontoStimatoIso: string,
): Promise<Riprogrammazione> {
  const svc = createServiceClient();

  const { data: ordine } = await svc
    .from("orders")
    .select("id, customer_id, laundry_id, eta_ready_at, delivery_slot_id, delivery_slot:slots!orders_delivery_slot_id_fkey(id, starts_at)")
    .eq("id", orderId)
    .maybeSingle<{
      id: string;
      customer_id: string | null;
      laundry_id: string | null;
      eta_ready_at: string | null;
      delivery_slot_id: string | null;
      // L'embed PostgREST è tipizzato array anche su relazione uno-a-uno.
      delivery_slot: Fascia | Fascia[] | null;
    }>();
  if (!ordine) return { esito: "resta", slotId: null, slotPrecedente: null, quandoNuova: null };

  const rel = ordine.delivery_slot;
  const attuale: Fascia | null = (Array.isArray(rel) ? rel[0] : rel) ?? null;

  // La scadenza interna si allunga sempre: senza, l'ordine comparirebbe fra gli
  // «in ritardo» del pannello per una cosa che abbiamo concordato noi.
  const eta = nuovaEta(ordine.eta_ready_at, prontoStimatoIso);
  if (eta !== ordine.eta_ready_at) await svc.from("orders").update({ eta_ready_at: eta }).eq("id", orderId);

  // Se la fascia promessa regge, si smette qui senza leggere altro.
  if (attuale && Date.parse(attuale.starts_at) >= Date.parse(prontoStimatoIso)) {
    return { esito: "resta", slotId: null, slotPrecedente: null, quandoNuova: null };
  }

  // Ordine senza riconsegna prenotata: la fascia la sceglie l'ops, come è
  // sempre stato. Qui si è solo allungata la scadenza, e l'ops la vedrà
  // aggiornata quando programmerà — che è tutto quello che serviva. Assegnarne
  // una d'ufficio darebbe al cliente un appuntamento che non ha mai chiesto.
  if (!attuale) return { esito: "resta", slotId: null, slotPrecedente: null, quandoNuova: null };

  // --- Il mondo: cosa il cliente ha già in calendario, e cosa è libero. ---

  // Consegne di ALTRI ordini dello stesso cliente. Accodarsi a una di queste
  // costa zero giri di furgone: è il caso migliore.
  const { data: altri } = ordine.customer_id
    ? await svc
        .from("orders")
        .select("id, delivery_slot:slots!orders_delivery_slot_id_fkey(id, starts_at)")
        .eq("customer_id", ordine.customer_id)
        .neq("id", orderId)
        .neq("status", "cancelled")
        .not("delivery_slot_id", "is", null)
        .returns<{ id: string; delivery_slot: Fascia | Fascia[] | null }[]>()
    : { data: [] };
  const giaInCalendario: Fascia[] = (altri ?? [])
    .map((o) => (Array.isArray(o.delivery_slot) ? o.delivery_slot[0] : o.delivery_slot))
    .filter((f): f is Fascia => !!f);

  // Fasce della stessa lavanderia, da ora fino a un tetto: oltre non è più un
  // servizio di lavanderia, è un magazzino.
  const tetto = new Date(Date.parse(prontoStimatoIso) + RITARDO_MASSIMO_GIORNI * 86_400_000).toISOString();
  const { data: candidate } = await svc
    .from("slots")
    .select("id, starts_at, capacity, laundry_id")
    .eq("kind", "delivery")
    .gte("starts_at", prontoStimatoIso)
    .lte("starts_at", tetto)
    .order("starts_at")
    .returns<{ id: string; starts_at: string; capacity: number | null; laundry_id: string | null }[]>();

  const dellaLavanderia = (candidate ?? []).filter(
    (s) => !ordine.laundry_id || !s.laundry_id || s.laundry_id === ordine.laundry_id,
  );
  const usate = await deliveryCounts(svc, dellaLavanderia.map((s) => s.id));
  const fasceLibere: Fascia[] = dellaLavanderia
    .filter((s) => s.capacity == null || (usate.get(s.id) ?? 0) < s.capacity)
    .map((s) => ({ id: s.id, starts_at: s.starts_at }));

  const scelta = scegliRiconsegna(prontoStimatoIso, attuale, giaInCalendario, fasceLibere);
  if (scelta.esito !== "spostata") {
    return { ...scelta, slotPrecedente: null, quandoNuova: null };
  }

  const { error } = await svc.from("orders").update({ delivery_slot_id: scelta.slotId }).eq("id", orderId);
  if (error) {
    // Il trigger di capacità (`enforce_slot_capacity`) può vincere una corsa
    // fra due segnalazioni simultanee. Non si riprova a caso: si dichiara che
    // serve una persona, che è la verità.
    console.error(`[riprogramma] fascia non assegnata su ${orderId}:`, error.message);
    return { esito: "nessuna_fascia", slotId: null, slotPrecedente: null, quandoNuova: null };
  }

  const nuova = fasceLibere.concat(giaInCalendario).find((f) => f.id === scelta.slotId) ?? null;
  return {
    esito: "spostata",
    slotId: scelta.slotId,
    slotPrecedente: attuale?.id ?? null,
    quandoNuova: nuova?.starts_at ?? null,
  };
}

/** Le fasce citate dalle segnalazioni, già scritte in italiano.
 *
 *  Sulla segnalazione restano due id: la riga da sola non sa dire «venerdì 4,
 *  12:00–14:00». Le pagine li risolvono con questa, in una query sola invece
 *  che una per riga. */
export async function etichetteFasce(
  svc: ReturnType<typeof createServiceClient>,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const puliti = [...new Set(ids.filter((v): v is string => !!v))];
  const m = new Map<string, string>();
  if (puliti.length === 0) return m;
  const { data } = await svc
    .from("slots")
    .select("id, starts_at, ends_at")
    .in("id", puliti)
    .returns<{ id: string; starts_at: string; ends_at: string }[]>();
  for (const s of data ?? []) m.set(s.id, fmtSlot(s.starts_at, s.ends_at));
  return m;
}
