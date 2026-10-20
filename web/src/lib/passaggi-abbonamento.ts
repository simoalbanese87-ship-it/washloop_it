import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cicloCorrente, contoPassaggi, frasePassaggi, type ContoPassaggi } from "@/lib/passaggi-inclusi";
import { ordiniDelCiclo } from "@/lib/ciclo-ordini";

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
  const usati = ciclo ? (await ordiniDelCiclo(svc, customerId, ciclo)).length : 0;
  const conto = contoPassaggi({
    perCiclo: sub.passaggi_per_ciclo,
    riportati: sub.passaggi_riportati,
    usati,
  });

  return { ...conto, scadeIl: sub.current_period_end, frase: frasePassaggi(conto, sub.current_period_end) };
}
