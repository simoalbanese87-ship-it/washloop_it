import "server-only";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { metodoDiPagamento } from "@/lib/metodo-pagamento";
import { METODI_FATTURA } from "@/lib/metodi-accettati";

/** Un addebito che si incassa **adesso**, non alla prossima fattura.
 *
 *  Un invoice item appeso al cliente aspetta il rinnovo per diventare soldi: su
 *  un abbonamento mensile sono fino a trenta giorni, e su un cliente che disdice
 *  prima non diventa niente. Per chi fa questo mestiere è un problema di cassa,
 *  non una sfumatura contabile — ed è la seconda volta che lo chiede.
 *
 *  Stessa macchina dei capi extra (`incasso-extra.ts`): una fattura fuori ciclo
 *  sul cliente, pagata subito con la carta salvata. Se il prelievo viene
 *  rifiutato la fattura resta aperta con il suo link, così l'importo non si
 *  perde e si può mandare al cliente. */

export type EsitoIncasso =
  | { esito: "incassato"; invoiceId: string }
  | { esito: "in-attesa"; invoiceId: string; link: string | null; motivo: string }
  | { esito: "senza-carta"; motivo: string };

/** Il cliente Stripe di una persona: sugli abbonati sta su `subscriptions`, su
 *  chi non ha mai avuto un abbonamento sul profilo. */
export async function clienteStripeDi(userId: string): Promise<{ customer: string | null; subscription: string | null }> {
  const svc = createServiceClient();
  const { data: sub } = await svc
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string | null; stripe_subscription_id: string | null }>();
  if (sub?.stripe_customer_id) return { customer: sub.stripe_customer_id, subscription: sub.stripe_subscription_id };

  const { data: prof } = await svc
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  return { customer: prof?.stripe_customer_id ?? null, subscription: null };
}

export async function incassaSubito(input: {
  userId: string;
  descrizione: string;
  importoCents: number;
  metadata?: Record<string, string>;
}): Promise<EsitoIncasso> {
  const { userId, descrizione, importoCents } = input;
  const { customer, subscription } = await clienteStripeDi(userId);
  if (!customer) {
    return { esito: "senza-carta", motivo: "Nessun profilo di pagamento su Stripe: l'addebito resta registrato e va incassato a parte." };
  }

  // Con quale carta: una fattura creata a parte non eredita il metodo della
  // subscription, e senza indicarlo Stripe rifiuta con «no default_payment_method».
  const carta = await metodoDiPagamento(customer, subscription);
  if (!carta) {
    return { esito: "senza-carta", motivo: "Nessuna carta salvata su Stripe: l'addebito resta registrato e va incassato a parte." };
  }

  const sk = stripe();
  const inv = await sk.invoices.create({
    customer,
    collection_method: "charge_automatically",
    default_payment_method: carta,
    auto_advance: false,
    payment_settings: { payment_method_types: [...METODI_FATTURA] },
    description: descrizione,
    metadata: { kind: "addebito_admin", customer_id: userId, ...(input.metadata ?? {}) },
  });

  await sk.invoiceItems.create({
    customer,
    invoice: inv.id,
    amount: importoCents,
    currency: "eur",
    description: `WashLoop · ${descrizione}`,
    metadata: { kind: "addebito_admin", customer_id: userId, ...(input.metadata ?? {}) },
  });

  try {
    await sk.invoices.finalizeInvoice(inv.id!);
    const pagata = await sk.invoices.pay(inv.id!, { payment_method: carta });
    if (pagata.status === "paid") return { esito: "incassato", invoiceId: inv.id! };
    return {
      esito: "in-attesa",
      invoiceId: inv.id!,
      link: pagata.hosted_invoice_url ?? null,
      motivo: `La fattura è stata emessa ma risulta ${pagata.status}.`,
    };
  } catch (err) {
    // Quasi sempre è la carta che chiede la conferma del titolare. La fattura
    // resta aperta con il suo link: l'importo non è perso, va mandato al cliente.
    const motivo = err instanceof Error ? err.message : "prelievo rifiutato";
    const link = await sk.invoices.retrieve(inv.id!).then((i) => i.hosted_invoice_url ?? null).catch(() => null);
    return { esito: "in-attesa", invoiceId: inv.id!, link, motivo };
  }
}
