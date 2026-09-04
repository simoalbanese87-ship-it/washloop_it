import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

/** Tutto quello che serve sapere di un cliente, in un posto solo.
 *
 *  La scheda mostrava l'abbonamento come lo abbiamo copiato noi in database,
 *  e nient'altro: niente incassi, niente ricevute, niente capi speciali,
 *  nessun saldo. Così un cliente poteva risultare "attivo" per settimane senza
 *  che nessuno potesse verificare se avesse mai pagato — è il dubbio su
 *  Emiliano, e non era possibile scioglierlo dal pannello.
 *
 *  Qui l'abbonamento si legge DA STRIPE quando c'è un id Stripe: la nostra
 *  copia arriva dai webhook e può essere rimasta indietro, mentre Stripe è la
 *  fonte del vero sui soldi. */

/** Una fattura Stripe come serve leggerla dal pannello: quando, quanto, com'è
 *  andata e dove si apre. `stato` resta la parola di Stripe perché è quella che
 *  si ritrova nella loro dashboard quando si va a controllare. */
export type FatturaStripe = {
  id: string;
  numero: string | null;
  data: string;
  importoCents: number;
  dovutoCents: number;
  stato: string;
  pagata: boolean;
  tentativi: number;
  url: string | null;
};

export type AbbonamentoStripe = {
  stato: string;
  statoItaliano: string;
  prezzoCents: number | null;
  periodoFino: string | null;
  prossimoAddebito: { data: string; importoCents: number } | null;
  disdettaAFinePeriodo: boolean;
  creatoIl: string | null;
  pagamentiRiusciti: number;
  totalePagatoCents: number;
  ultimoPagamento: string | null;
  /** Le singole fatture, dalla più recente. Erano già scaricate per contarle e
   *  poi buttate: la scheda diceva "1 pagamento, €160" senza mai dire quale, e
   *  con un pagamento fallito non c'era modo di vedere quale fattura fosse
   *  rimasta aperta. */
  fatture: FatturaStripe[];
  errore?: string;
};

const STATO_IT: Record<string, string> = {
  active: "Attivo",
  trialing: "In prova",
  past_due: "Pagamento fallito",
  unpaid: "Non pagato",
  canceled: "Disdetto",
  incomplete: "Mai completato",
  incomplete_expired: "Scaduto senza pagamento",
  paused: "In pausa",
};

export const statoAbbonamentoItaliano = (s: string | null | undefined) => (s ? STATO_IT[s] ?? s : "Nessun abbonamento");

/** Verità su un abbonamento, presa da Stripe. Include lo storico pagamenti,
 *  che è ciò che dice se il cliente ha davvero versato qualcosa. */
export async function abbonamentoDaStripe(subId: string, customerId?: string | null): Promise<AbbonamentoStripe | null> {
  try {
    const sub = await stripe().subscriptions.retrieve(subId, { expand: ["items.data.price"] });
    const item = sub.items?.data?.[0];
    const prezzo = item?.price?.unit_amount ?? null;

    // Pagamenti realmente riusciti su questo cliente: è il dato che manca in
    // pannello e che serve a rispondere «ha pagato o no?».
    let pagamentiRiusciti = 0;
    let totalePagatoCents = 0;
    let ultimoPagamento: string | null = null;
    const righeFatture: FatturaStripe[] = [];
    if (customerId) {
      const fatture = await stripe().invoices.list({ customer: customerId, limit: 100 });
      for (const f of fatture.data) {
        const pagata = (f.amount_paid ?? 0) > 0;
        if (pagata) {
          pagamentiRiusciti++;
          totalePagatoCents += f.amount_paid ?? 0;
          const quando = f.status_transitions?.paid_at ?? f.created;
          const iso = new Date(quando * 1000).toISOString();
          if (!ultimoPagamento || iso > ultimoPagamento) ultimoPagamento = iso;
        }
        righeFatture.push({
          id: f.id ?? "",
          numero: f.number ?? null,
          data: new Date((f.status_transitions?.paid_at ?? f.created) * 1000).toISOString(),
          importoCents: f.amount_paid ?? 0,
          dovutoCents: f.amount_due ?? 0,
          stato: f.status ?? "sconosciuto",
          pagata,
          tentativi: f.attempt_count ?? 0,
          url: f.hosted_invoice_url ?? f.invoice_pdf ?? null,
        });
      }
      righeFatture.sort((a, b) => (a.data < b.data ? 1 : -1));
    }

    // Nelle API Stripe recenti la fine del periodo sta sugli ITEM, non più sulla
    // subscription: leggendo solo il livello alto risultava sempre assente, e la
    // scheda diceva "nessun addebito futuro programmato" anche per un
    // abbonamento sano che rinnova domani. `subscription-sync` già lo gestiva
    // così, questa parte era rimasta indietro.
    const fine =
      (sub as unknown as { current_period_end?: number }).current_period_end ??
      (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
    return {
      stato: sub.status,
      statoItaliano: statoAbbonamentoItaliano(sub.status),
      prezzoCents: prezzo,
      periodoFino: fine ? new Date(fine * 1000).toISOString() : null,
      prossimoAddebito:
        sub.status === "active" && !sub.cancel_at_period_end && fine
          ? { data: new Date(fine * 1000).toISOString(), importoCents: prezzo ?? 0 }
          : null,
      disdettaAFinePeriodo: sub.cancel_at_period_end === true,
      creatoIl: sub.created ? new Date(sub.created * 1000).toISOString() : null,
      pagamentiRiusciti,
      totalePagatoCents,
      ultimoPagamento,
      fatture: righeFatture,
    };
  } catch (err) {
    // Chiave mancante, id non più esistente, rete: la scheda deve aprirsi
    // comunque, con scritto perché il dato non c'è.
    return {
      stato: "sconosciuto",
      statoItaliano: "Non verificabile su Stripe",
      prezzoCents: null,
      periodoFino: null,
      prossimoAddebito: null,
      disdettaAFinePeriodo: false,
      creatoIl: null,
      pagamentiRiusciti: 0,
      totalePagatoCents: 0,
      ultimoPagamento: null,
      fatture: [],
      errore: err instanceof Error ? err.message : "errore sconosciuto",
    };
  }
}

export type IncassoCliente = {
  id: string;
  amount_cents: number;
  created_at: string;
  stato: string;
  fic_number: string | null;
  fic_url: string | null;
};

export type CapoSpeciale = {
  /** Quante ne sono state trovate e quante ne ha assorbite l'abbonamento.
   *  Nulle sulle righe registrate prima che il sistema applicasse la franchigia. */
  qty_totale?: number | null;
  qty_inclusa?: number | null;
  id: string;
  item_name: string;
  qty: number;
  price_cli_cents: number;
  created_at: string;
  charged_at: string | null;
  refunded_at: string | null;
  order_id: string;
};

/** Incassi registrati da noi (ricevute, e fatture dove esistono). */
export async function incassiCliente(userId: string): Promise<IncassoCliente[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("invoices")
    .select("id, amount_cents, created_at, stato, fic_number, fic_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<IncassoCliente[]>();
  return data ?? [];
}

/** Capi fuori abbonamento del cliente: si vedevano solo entrando nel singolo ordine. */
export async function capiSpecialiCliente(userId: string): Promise<CapoSpeciale[]> {
  const svc = createServiceClient();
  const { data: ordini } = await svc.from("orders").select("id").eq("customer_id", userId).returns<{ id: string }[]>();
  const ids = (ordini ?? []).map((o) => o.id);
  if (ids.length === 0) return [];

  const { data } = await svc
    .from("order_specials")
    .select("id, item_name, qty, qty_totale, qty_inclusa, price_cli_cents, created_at, charged_at, refunded_at, order_id")
    .in("order_id", ids)
    .order("created_at", { ascending: false })
    .returns<CapoSpeciale[]>();
  return data ?? [];
}
