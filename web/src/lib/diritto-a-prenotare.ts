import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { saldoRitiri } from "@/lib/saldo-ritiri";
import { canoneACadenzaLibera, type ChiPrenota } from "@/lib/puo-prenotare";

/** Tutto quello che serve per decidere se uno può prenotare, raccolto una
 *  volta sola.
 *
 *  Perché sta qui e non dentro l'azione: le cose da guardare sono quattro —
 *  stato dell'abbonamento, accordo a consumo, ritiri comprati, e se
 *  l'abbonamento è di quelli che danno un numero di ritiri — e vanno guardate
 *  allo stesso modo in cinque posti (le due azioni che creano un ordine, le
 *  due pagine dell'area clienti, il cron delle ricorrenze). Cinque copie sono
 *  cinque occasioni di divergere, e la copia che diverge è quella che lascia
 *  prenotare chi non può.
 *
 *  **Legge col service client.** È la regola della casa dal 9 ottobre: una
 *  lettura che decide non si fa con la sessione del cliente, perché una policy
 *  che nega non dà errore — torna vuoto. Qui un saldo vuoto per sbaglio
 *  bloccherebbe una persona che ha pagato.
 *
 *  Quale borsa si svuota per prima
 *  -------------------------------
 *  Se il canone copre già il ritiro — abbonamento vivo a cadenza libera — il
 *  ritiro comprato **non** si tocca: è stato pagato a parte e non deve
 *  sciogliersi dentro un canone che quel passaggio lo comprende già. */

export type Diritto = ChiPrenota & {
  /** Questo ordine consuma un ritiro comprato: va scritto `ritiro_pagato_at`. */
  consumaRitiro: boolean;
};

export async function dirittoAPrenotare(customerId: string, svcIn?: SupabaseClient): Promise<Diritto> {
  const svc = svcIn ?? createServiceClient();

  const [{ data: sub }, { data: io }, ritiri] = await Promise.all([
    svc
      .from("subscriptions")
      .select("status, ritiri_per_rinnovo")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string; ritiri_per_rinnovo: number | null }>(),
    svc.from("profiles").select("a_consumo").eq("id", customerId).maybeSingle<{ a_consumo: boolean | null }>(),
    saldoRitiri(svc, customerId),
  ]);

  const chi: ChiPrenota = {
    statoAbbonamento: sub?.status ?? null,
    aConsumo: io?.a_consumo ?? null,
    ritiri: ritiri.residui,
    ritiriAccreditati: ritiri.accreditati,
    abbonamentoARitiri: sub?.ritiri_per_rinnovo != null,
  };

  return { ...chi, consumaRitiro: !canoneACadenzaLibera(chi) && ritiri.residui > 0 };
}
