import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contoGettoni, fraseGettoni, type ContoGettoni } from "@/lib/gettoni";

/** Il saldo dei gettoni di un cliente, letto dal database.
 *
 *  Gemella di `gettoni.ts`: qui c'è solo la lettura, la regola sta nel modulo
 *  puro che ha i test.
 *
 *  **Va chiamata col service client.** Questo saldo decide se una persona che
 *  ha pagato può prenotare: con la sessione dell'utente una policy che nega
 *  non dà errore, torna una lista vuota — e un saldo a zero per sbaglio
 *  bloccherebbe un cliente in regola. È la regola della casa dal 9 ottobre.
 *
 *  Cosa conta come usato: **un ordine non annullato con `gettone_at`
 *  valorizzato**. Gli ordini nati prima dei gettoni, o pagati dall'abbonamento,
 *  non hanno quel campo e quindi non toccano il saldo. */

export type SaldoGettoni = ContoGettoni & {
  /** La frase pronta, o `null` per chi non ha mai comprato un ritiro. */
  frase: string | null;
};

export async function saldoGettoni(svc: SupabaseClient, customerId: string): Promise<SaldoGettoni> {
  const [accrediti, usati] = await Promise.all([
    svc.from("gettoni").select("quanti").eq("customer_id", customerId).returns<{ quanti: number }[]>(),
    svc
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .not("gettone_at", "is", null)
      .neq("status", "cancelled"),
  ]);

  const conto = contoGettoni({
    accreditati: (accrediti.data ?? []).reduce((s, r) => s + (r.quanti ?? 0), 0),
    usati: usati.count ?? 0,
  });

  return { ...conto, frase: fraseGettoni(conto) };
}

/** Quanto ha pagato l'ultima volta per un ritiro, in centesimi.
 *
 *  Serve al bottone «compra un altro ritiro»: il prezzo è quello concordato
 *  con lui, non quello di listino, perché è il prezzo che ha già accettato e
 *  che si aspetta di ritrovare. `null` se non ha mai comprato ritiri. */
export async function prezzoUltimoRitiro(svc: SupabaseClient, customerId: string): Promise<number | null> {
  const { data } = await svc
    .from("subscription_offers")
    .select("amount_cents, gettoni")
    .eq("user_id", customerId)
    .not("gettoni", "is", null)
    .not("pagato_at", "is", null)
    .order("pagato_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ amount_cents: number; gettoni: number }>();

  if (!data || !data.gettoni) return null;
  return Math.round(data.amount_cents / data.gettoni);
}
