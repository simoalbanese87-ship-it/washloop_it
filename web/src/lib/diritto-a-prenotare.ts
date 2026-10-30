import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { saldoGettoni } from "@/lib/saldo-gettoni";
import { saldoPassaggi } from "@/lib/passaggi-abbonamento";
import { abbonamentoVivo, type ChiPrenota } from "@/lib/puo-prenotare";

/** Tutto quello che serve per decidere se uno può prenotare, raccolto una
 *  volta sola.
 *
 *  Perché sta qui e non dentro l'azione: le cose da guardare sono diventate
 *  quattro — stato dell'abbonamento, accordo a consumo, gettoni comprati,
 *  passaggi del periodo — e vanno guardate allo stesso modo in cinque posti
 *  (le due azioni che creano un ordine, le due pagine dell'area clienti, il
 *  cron delle ricorrenze). Cinque copie sono cinque occasioni di divergere, e
 *  la copia che diverge è quella che lascia prenotare chi non può.
 *
 *  **Legge col service client.** È la regola della casa dal 9 ottobre: una
 *  lettura che decide non si fa con la sessione del cliente, perché una policy
 *  che nega non dà errore — torna vuoto. Qui un saldo vuoto per sbaglio
 *  bloccherebbe una persona che ha pagato.
 *
 *  Quale borsa si svuota per prima
 *  -------------------------------
 *  Se l'abbonamento copre il ritiro, il gettone **non** si tocca: è stato
 *  comprato a parte e non deve sciogliersi dentro un canone che già comprende
 *  quel passaggio. Il gettone si consuma solo quando è lui a dare il permesso. */

export type Diritto = ChiPrenota & {
  /** Questo ritiro consuma un gettone: va scritto `gettone_at` sull'ordine. */
  consumaGettone: boolean;
};

export async function dirittoAPrenotare(customerId: string, svcIn?: SupabaseClient): Promise<Diritto> {
  const svc = svcIn ?? createServiceClient();

  const [{ data: sub }, { data: io }, gettoni, passaggi] = await Promise.all([
    svc
      .from("subscriptions")
      .select("status")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string }>(),
    svc.from("profiles").select("a_consumo").eq("id", customerId).maybeSingle<{ a_consumo: boolean | null }>(),
    saldoGettoni(svc, customerId),
    saldoPassaggi(svc, customerId),
  ]);

  const statoAbbonamento = sub?.status ?? null;
  const residuiPassaggi = passaggi?.residui ?? null;
  // L'abbonamento copre il ritiro quando è vivo e non ha finito il suo tetto.
  // `residui` a `null` vuol dire «nessun tetto», che è il caso di tutti gli
  // abbonamenti storici: quelli coprono sempre.
  const abbonamentoCopre = abbonamentoVivo(statoAbbonamento) && !(typeof residuiPassaggi === "number" && residuiPassaggi <= 0);

  return {
    statoAbbonamento,
    aConsumo: io?.a_consumo ?? null,
    gettoni: gettoni.residui,
    gettoniAccreditati: gettoni.accreditati,
    residuiPassaggi,
    consumaGettone: !abbonamentoCopre && gettoni.residui > 0,
  };
}
