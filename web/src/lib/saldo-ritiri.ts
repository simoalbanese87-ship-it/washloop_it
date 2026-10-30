import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contoRitiri, fraseRitiri, type ContoRitiri } from "@/lib/ritiri-comprati";

/** Il saldo dei ritiri comprati, letto dal database.
 *
 *  Gemella di `ritiri-comprati.ts`: qui c'è solo la lettura, la regola sta nel
 *  modulo puro che ha i test.
 *
 *  **Va chiamata col service client.** Questo saldo decide se una persona che
 *  ha pagato può prenotare: con la sessione dell'utente una policy che nega
 *  non dà errore, torna una lista vuota — e un saldo a zero per sbaglio
 *  bloccherebbe un cliente in regola. È la regola della casa dal 9 ottobre.
 *
 *  Cosa conta come usato: **un ordine non annullato con `ritiro_pagato_at`
 *  valorizzato**. Gli ordini nati prima, o pagati dal canone, non hanno quel
 *  campo e quindi non toccano il saldo. */

export type SaldoRitiri = ContoRitiri & {
  /** La frase pronta, o `null` per chi non ne ha mai avuti. */
  frase: string | null;
};

export async function saldoRitiri(svc: SupabaseClient, customerId: string): Promise<SaldoRitiri> {
  const [accrediti, usati] = await Promise.all([
    svc
      .from("ritiri_comprati")
      .select("quanti_ritiri")
      .eq("customer_id", customerId)
      .returns<{ quanti_ritiri: number }[]>(),
    svc
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .not("ritiro_pagato_at", "is", null)
      .neq("status", "cancelled"),
  ]);

  const conto = contoRitiri({
    accreditati: (accrediti.data ?? []).reduce((s, r) => s + (r.quanti_ritiri ?? 0), 0),
    usati: usati.count ?? 0,
  });

  return { ...conto, frase: fraseRitiri(conto) };
}

/** Quanto ha pagato l'ultima volta per un ritiro, in centesimi.
 *
 *  Serve al bottone «compra un altro ritiro»: il prezzo è quello che ha pagato
 *  l'ultima volta, cioè quello concordato con lui, perché è il prezzo che ha
 *  già accettato e che si aspetta di ritrovare. `null` se non ha mai comprato
 *  ritiri. */
export async function prezzoUltimoRitiro(svc: SupabaseClient, customerId: string): Promise<number | null> {
  const { data } = await svc
    .from("subscription_offers")
    .select("amount_cents, ritiri")
    .eq("user_id", customerId)
    .not("ritiri", "is", null)
    .not("pagato_at", "is", null)
    .order("pagato_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ amount_cents: number; ritiri: number }>();

  if (!data || !data.ritiri) return null;
  return Math.round(data.amount_cents / data.ritiri);
}
