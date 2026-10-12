import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { incassaSubito } from "@/lib/incasso-subito";

/** L'addebito di un ritiro a sacco: tanti sacchi, un prezzo per sacco.
 *
 *  Quando parte
 *  ------------
 *  **Solo dopo che la lavanderia ha contato.** È la regola del 9 ottobre 2026,
 *  nata dalle quattro camicie addebitate a Elvira su un sacco quando i sacchi
 *  erano due: prima il dato, poi i soldi. Qui vale ancora di più, perché il
 *  prezzo *è* il numero di sacchi — addebitare al ritiro vorrebbe dire fatturare
 *  la stima fatta in prenotazione.
 *
 *  Idempotente: una riga sola per ordine. `customer_charges` è la stessa tabella
 *  degli addebiti fatti a mano dal pannello, quindi il ricavo entra in
 *  Competenza fra gli addebiti e non si confonde con il canone — che su un
 *  cliente a sacco non esiste.
 *
 *  Se la carta non c'è o il prelievo viene rifiutato la riga resta comunque
 *  scritta, con l'esito: un incasso mancato si deve vedere, non sparire. */

export type EsitoSacco =
  | { esito: "niente"; motivo: string }
  | { esito: "incassato"; totaleCents: number; sacchi: number }
  | { esito: "registrato"; totaleCents: number; sacchi: number; motivo: string };

export async function incassaSaccoDelRitiro(svc: SupabaseClient, orderId: string): Promise<EsitoSacco> {
  const { data: ordine } = await svc
    .from("orders")
    .select("id, customer_id, bags, bags_arrivati, servizio_sacco_id, servizi_sacco(nome, price_cli_cents)")
    .eq("id", orderId)
    .maybeSingle<{
      id: string;
      customer_id: string;
      bags: number | null;
      bags_arrivati: number | null;
      servizio_sacco_id: string | null;
      servizi_sacco: { nome: string; price_cli_cents: number } | { nome: string; price_cli_cents: number }[] | null;
    }>();

  if (!ordine?.servizio_sacco_id) return { esito: "niente", motivo: "Non è un ritiro a sacco." };

  const rel = ordine.servizi_sacco;
  const servizio = Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
  if (!servizio) return { esito: "niente", motivo: "Il servizio a sacco di questo ordine non esiste più." };

  // Si fattura quello che la lavanderia ha contato, e basta. `orders.bags` è la
  // stima della prenotazione: su un servizio dove il sacco è il prezzo, usarla
  // vorrebbe dire mandare una fattura a indovinare.
  const sacchi = ordine.bags_arrivati ?? 0;
  if (sacchi <= 0) return { esito: "niente", motivo: "Nessun sacco contato: niente da addebitare." };

  const { data: gia } = await svc
    .from("customer_charges")
    .select("id")
    .eq("order_id", orderId)
    .eq("kind", "sacco")
    .neq("status", "void")
    .maybeSingle<{ id: string }>();
  if (gia) return { esito: "niente", motivo: "Questo ritiro è già stato addebitato." };

  const totaleCents = servizio.price_cli_cents * sacchi;
  const descrizione = `${servizio.nome} × ${sacchi}`;

  const esito = await incassaSubito({
    userId: ordine.customer_id,
    descrizione,
    importoCents: totaleCents,
    metadata: { order_id: orderId, servizio_sacco_id: ordine.servizio_sacco_id, sacchi: String(sacchi) },
  });

  // Gli stessi stati degli addebiti del pannello, per non inventare un
  // vocabolario secondo: «settled» incassato, «invoiced» la fattura c'è e
  // aspetta di essere pagata, «pending» non siamo riusciti nemmeno a emetterla.
  await svc.from("customer_charges").insert({
    customer_id: ordine.customer_id,
    order_id: orderId,
    kind: "sacco",
    description: descrizione,
    amount_cents: totaleCents,
    status: esito.esito === "incassato" ? "settled" : esito.esito === "in-attesa" ? "invoiced" : "pending",
    stripe_ref: esito.esito === "senza-carta" ? null : esito.invoiceId,
  });

  if (esito.esito === "incassato") return { esito: "incassato", totaleCents, sacchi };
  return { esito: "registrato", totaleCents, sacchi, motivo: esito.motivo };
}
