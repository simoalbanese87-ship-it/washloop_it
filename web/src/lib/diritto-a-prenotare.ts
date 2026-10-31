import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { saldoRitiri } from "@/lib/saldo-ritiri";
import { canoneACadenzaLibera, type ChiPrenota } from "@/lib/puo-prenotare";
import { settimanaRoma } from "@/lib/settimana-roma";

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

/** Il ritiro che il cliente ha già in una certa settimana.
 *
 *  **Un ritiro a settimana** è la regola del servizio, e fino al 31 ottobre
 *  2026 non era scritta: reggeva perché la lavanderia ha un giorno solo. Lo
 *  stiro ne ha due, e lì bastava prenotarli entrambi.
 *
 *  Si contano **solo i ritiri vivi**: chi disdice il martedì libera la
 *  settimana e può riprendere il mercoledì. Cambiare idea non consuma niente —
 *  e nemmeno il ritiro comprato, che torna con l'annullo.
 *
 *  `escludiOrdine` serve a chi **sposta** un ritiro: senza, l'ordine
 *  inciamperebbe in se stesso e non si potrebbe spostarlo dentro la sua
 *  settimana.
 *
 *  Si guarda dall'inizio della settimana in corso in avanti: quello che è
 *  successo prima non limita niente. */
export type RitiroInSettimana = { settimana: string; quandoIso: string };

export async function ritiriPerSettimana(
  customerId: string,
  svcIn?: SupabaseClient,
  opts?: { escludiOrdine?: string | null },
): Promise<Map<string, RitiroInSettimana>> {
  const svc = svcIn ?? createServiceClient();
  const inizio = `${settimanaRoma(new Date())}T00:00:00.000Z`;

  const { data } = await svc
    .from("orders")
    .select("id, created_at, pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at)")
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    .gte("created_at", new Date(Date.parse(inizio) - 60 * 86_400_000).toISOString())
    .returns<{ id: string; created_at: string; pickup_slot: { starts_at: string } | null }[]>();

  const per = new Map<string, RitiroInSettimana>();
  for (const o of data ?? []) {
    if (opts?.escludiOrdine && o.id === opts.escludiOrdine) continue;
    // La fascia di ritiro è il fatto; la data di creazione è il ripiego per i
    // pochi ordini nati senza fascia, come fa il conto dei passaggi.
    const quandoIso = o.pickup_slot?.starts_at ?? o.created_at;
    if (quandoIso < inizio) continue;
    const settimana = settimanaRoma(quandoIso);
    const gia = per.get(settimana);
    if (!gia || quandoIso < gia.quandoIso) per.set(settimana, { settimana, quandoIso });
  }
  return per;
}
