import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { registraGuasto } from "@/lib/incidenti";
import { metodoDiPagamento } from "@/lib/metodo-pagamento";
import { capiDaIncassare, totaleCents } from "@/lib/extra-selezione";

/** Incassa in un colpo solo i capi speciali di un ritiro.
 *
 *  Quando e perché
 *  ---------------
 *  Parte quando la lavanderia segna il sacco **pronto**. È il momento giusto per
 *  due ragioni: il sacco è finito e non può più arrivare un altro capo, quindi
 *  il totale è completo; ed è un gesto che la lavanderia fa comunque.
 *
 *  Prima l'addebito era una voce agganciata all'abbonamento, che diventava soldi
 *  solo alla fattura di rinnovo. Su un cliente che disdice prima, mai: le tre
 *  camicie di Giulia stanno lì dal 1° settembre, contrassegnate come addebitate
 *  e con zero euro incassati. Alla lavanderia quei capi li paghiamo comunque.
 *
 *  Una fattura sola, una riga per capo
 *  -----------------------------------
 *  L'importo si raggruppa ma il dettaglio resta: sulla ricevuta il cliente deve
 *  leggere «1× Giacca», non «capi vari». E ogni incasso su Stripe paga una
 *  commissione fissa oltre alla percentuale — tre camicie in un colpo la pagano
 *  una volta sola invece di tre.
 *
 *  L'ordine delle operazioni non è un dettaglio: **prima la fattura vuota, poi
 *  le voci dentro**. Creando la fattura dopo, Stripe ci raccoglierebbe anche
 *  tutte le altre voci in sospeso del cliente — comprese quelle vecchie in coda
 *  per il rinnovo — e si incasserebbe roba non decisa qui.
 *
 *  Non lancia mai
 *  --------------
 *  Qualunque cosa vada storta viene catturata e scritta. Un problema con Stripe
 *  non deve impedire alla lavanderia di chiudere il sacco: quello è lavoro
 *  fisico che è già stato fatto, e bloccarlo per un problema di incasso
 *  significherebbe un sacco pronto che resta «in lavorazione» sul tabellone. */

export type EsitoIncasso =
  | { esito: "niente" }
  | { esito: "incassato"; totaleCents: number; capi: number; invoiceId: string }
  | { esito: "fallito"; totaleCents: number; capi: number; motivo: string; link: string | null };

type Capo = { id: string; item_name: string; qty: number; price_cli_cents: number };

export async function incassaExtraDelRitiro(svc: SupabaseClient, orderId: string): Promise<EsitoIncasso> {
  try {
    const { data: ordine } = await svc
      .from("orders")
      .select("id, customer_id")
      .eq("id", orderId)
      .maybeSingle<{ id: string; customer_id: string | null }>();
    if (!ordine?.customer_id) return { esito: "niente" };

    const { data: righe } = await svc
      .from("order_specials")
      .select("id, item_name, qty, price_cli_cents, charged_at, refunded_at, annullato_at")
      .eq("order_id", orderId)
      .returns<(Capo & { charged_at: string | null; refunded_at: string | null; annullato_at: string | null })[]>();

    const capi = capiDaIncassare(righe ?? []);
    if (capi.length === 0) return { esito: "niente" };

    const totale = totaleCents(capi);
    const ids = capi.map((c) => c.id);

    const segnaFallito = async (motivo: string, link: string | null, invoiceId: string | null) => {
      await svc
        .from("order_specials")
        .update({
          incasso_fallito_at: new Date().toISOString(),
          incasso_errore: motivo,
          link_pagamento: link,
          ...(invoiceId ? { stripe_invoice_id: invoiceId } : {}),
        })
        .in("id", ids);
    };

    const { data: sub } = await svc
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", ordine.customer_id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ stripe_customer_id: string | null; stripe_subscription_id: string | null }>();

    if (!sub?.stripe_customer_id) {
      // Non è un guasto tecnico, è un fatto da mostrare: senza un profilo di
      // pagamento non c'è una carta da cui prelevare, e quei capi vanno
      // incassati in un altro modo. Meglio saperlo oggi che al rinnovo.
      const motivo = "Il cliente non ha un profilo di pagamento su Stripe: non c'è una carta da cui prelevare.";
      await segnaFallito(motivo, null, null);
      return { esito: "fallito", totaleCents: totale, capi: capi.length, motivo, link: null };
    }

    const sk = stripe();

    // Con quale carta. La fattura dei capi extra nasce sul Customer, e lì di
    // carte predefinite non ce n'è: il metodo va indicato a mano, altrimenti
    // Stripe rifiuta con «There is no default_payment_method set on this
    // Customer or Invoice» — che è quello che ha bloccato il primo incasso.
    const carta = await metodoDiPagamento(sub.stripe_customer_id, sub.stripe_subscription_id);
    if (!carta) {
      const motivo = "Il cliente non ha nessuna carta salvata su Stripe: non c'è da dove prelevare.";
      await segnaFallito(motivo, null, null);
      return { esito: "fallito", totaleCents: totale, capi: capi.length, motivo, link: null };
    }

    const inv = await sk.invoices.create({
      customer: sub.stripe_customer_id,
      collection_method: "charge_automatically",
      default_payment_method: carta,
      auto_advance: false,
      description: `Capi fuori abbonamento · ritiro ${orderId.slice(0, 8)}`,
      metadata: { kind: "extra_ritiro", order_id: orderId, capi: String(capi.length) },
    });

    for (const c of capi) {
      await sk.invoiceItems.create({
        customer: sub.stripe_customer_id,
        invoice: inv.id,
        amount: c.price_cli_cents * c.qty,
        currency: "eur",
        description: `WashLoop · ${c.item_name}${c.qty > 1 ? ` ×${c.qty}` : ""}`,
        metadata: { order_id: orderId, special_id: c.id, kind: "order_specials" },
      });
    }

    // Da qui le voci esistono su Stripe: si segnano subito come chieste. Se il
    // prelievo poi fallisce, restano segnate — e devono restarlo, altrimenti la
    // prossima chiamata le rimetterebbe su una seconda fattura e il cliente si
    // vedrebbe addebitare due volte lo stesso capo.
    await svc
      .from("order_specials")
      .update({ charged_at: new Date().toISOString(), stripe_invoice_id: inv.id })
      .in("id", ids);

    try {
      await sk.invoices.finalizeInvoice(inv.id!);
      const pagata = await sk.invoices.pay(inv.id!, { payment_method: carta });
      if (pagata.status === "paid") {
        // `incassato_at` lo scrive il webhook `invoice.payment_succeeded`, che è
        // l'unico punto in cui Stripe conferma che i soldi si sono mossi. Qui si
        // sa solo che la chiamata è andata a buon fine, che è una cosa diversa.
        return { esito: "incassato", totaleCents: totale, capi: capi.length, invoiceId: inv.id! };
      }
      const motivo = `La fattura è stata emessa ma risulta ${pagata.status}.`;
      await segnaFallito(motivo, pagata.hosted_invoice_url ?? null, inv.id!);
      return { esito: "fallito", totaleCents: totale, capi: capi.length, motivo, link: pagata.hosted_invoice_url ?? null };
    } catch (err) {
      // Prelievo rifiutato: quasi sempre è la carta che chiede la conferma del
      // titolare. La fattura resta aperta con il suo link, quindi l'importo non
      // è perso — va mandato al cliente, e per questo il link si salva.
      const motivo = err instanceof Error ? err.message : "prelievo rifiutato";
      const link = await sk.invoices.retrieve(inv.id!).then((i) => i.hosted_invoice_url ?? null).catch(() => null);
      await segnaFallito(motivo, link, inv.id!);
      return { esito: "fallito", totaleCents: totale, capi: capi.length, motivo, link };
    }
  } catch (err) {
    // Il «pronto» della lavanderia non deve fallire per un problema di incasso:
    // il lavoro fisico è già stato fatto, e un sacco pronto che resta «in
    // lavorazione» sul tabellone è un danno peggiore di un incasso mancato.
    await registraGuasto("stripe", `Incasso extra del ritiro ${orderId} non riuscito`, {
      order_id: orderId,
      errore: err instanceof Error ? err.message : String(err),
    });
    return { esito: "niente" };
  }
}
