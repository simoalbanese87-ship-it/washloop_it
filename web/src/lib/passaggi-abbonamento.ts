import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cicloCorrente, contoPassaggi, frasePassaggi, type ContoPassaggi } from "@/lib/passaggi-inclusi";

/** Il saldo dei passaggi di un cliente, letto dal database.
 *
 *  Gemella di `sacchiInclusi`: qui c'è solo la lettura, la regola sta nel
 *  modulo puro `passaggi-inclusi.ts` che ha i test.
 *
 *  **Va chiamata col service client.** La conta degli ordini decide cosa si
 *  dice a un cliente che paga: con la sessione dell'utente una policy che
 *  nega non dà errore, torna una lista vuota — e un saldo pieno per sbaglio è
 *  peggio di nessun saldo. È la regola della casa dal 9 ottobre.
 *
 *  Cosa conta come passaggio: **un ordine non annullato il cui ritiro cade
 *  dentro il ciclo**. Si guarda la fascia di ritiro, come fa Competenza; se
 *  l'ordine non ha ancora una fascia (è raro, succede su quelli creati a mano)
 *  vale la data di creazione, che è l'unica altra cosa vera che abbiamo. */

export type SaldoPassaggi = ContoPassaggi & {
  /** Fine del ciclo: la data entro cui vanno usati. */
  scadeIl: string | null;
  /** La frase pronta, o `null` per chi non ha un tetto. */
  frase: string | null;
};

type SubRiga = {
  id: string;
  status: string;
  current_period_end: string | null;
  passaggi_per_ciclo: number | null;
  passaggi_riportati: number | null;
};

export async function saldoPassaggi(svc: SupabaseClient, customerId: string): Promise<SaldoPassaggi | null> {
  const { data: sub } = await svc
    .from("subscriptions")
    .select("id, status, current_period_end, passaggi_per_ciclo, passaggi_riportati")
    .eq("user_id", customerId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubRiga>();

  if (!sub) return null;

  const ciclo = cicloCorrente(sub.current_period_end);
  const usati = ciclo ? await passaggiUsati(svc, customerId, ciclo) : 0;
  const conto = contoPassaggi({
    perCiclo: sub.passaggi_per_ciclo,
    riportati: sub.passaggi_riportati,
    usati,
  });

  return { ...conto, scadeIl: sub.current_period_end, frase: frasePassaggi(conto, sub.current_period_end) };
}

/** Gli ordini che consumano un passaggio in questo ciclo.
 *
 *  Due query invece di una: PostgREST non sa filtrare su una colonna della
 *  tabella collegata e insieme tenere le righe che quella tabella non ce
 *  l'hanno. Quindi si prendono gli ordini vivi del cliente con la data del loro
 *  ritiro e si filtra qui, dove la regola si legge. */
async function passaggiUsati(
  svc: SupabaseClient,
  customerId: string,
  ciclo: { dalIso: string; alIso: string },
): Promise<number> {
  const { data } = await svc
    .from("orders")
    .select("id, created_at, status, ritiro:slots!orders_pickup_slot_id_fkey(starts_at)")
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    // Un margine indietro sulla creazione: un ordine creato prima del ciclo ma
    // con il ritiro dentro conta lo stesso, ed è il caso normale di chi prenota
    // con una settimana di anticipo.
    .gte("created_at", new Date(new Date(ciclo.dalIso).getTime() - 60 * 24 * 3600 * 1000).toISOString())
    .returns<{ id: string; created_at: string; status: string; ritiro: { starts_at: string } | { starts_at: string }[] | null }[]>();

  const dentro = (iso: string) => iso >= ciclo.dalIso && iso < ciclo.alIso;

  return (data ?? []).filter((o) => {
    const rel = o.ritiro;
    const slot = Array.isArray(rel) ? rel[0] ?? null : rel;
    return dentro(slot?.starts_at ?? o.created_at);
  }).length;
}
