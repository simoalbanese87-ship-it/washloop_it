import { NextResponse, after, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { eventoGiaVisto, syncSubscription } from "@/lib/subscription-sync";
import { sendMail } from "@/lib/email";
import { registraIncasso } from "@/lib/fatturazione";
import { chargeEmailHtml } from "@/lib/email-templates";
import { LEGAL } from "@/lib/legal";
import { fmtDate } from "@/lib/format";
import { inviaSollecito, chiudiRecupero } from "@/lib/dunning";
import { registraGuasto } from "@/lib/incidenti";

/** Webhook Stripe → aggiorna `subscriptions` con service-role (bypassa RLS).
 *  Eventi: checkout completato, subscription creata/aggiornata/cancellata,
 *  fattura pagata, pagamento fallito.
 *
 *  Due regole che prima mancavano:
 *  - ogni evento viene processato UNA volta sola (Stripe ritenta per 3 giorni);
 *  - se il salvataggio fallisce rispondiamo 500, così Stripe ritenta. Prima si
 *    rispondeva 200 comunque e il dato spariva per sempre. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "config" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `signature: ${(err as Error).message}` }, { status: 400 });
  }

  if (await eventoGiaVisto(event.id, event.type)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const db = createServiceClient();

  /** Wrapper: propaga l'errore in modo che la route risponda 500 e Stripe ritenti. */
  async function upsertFromSubscription(sub: Stripe.Subscription) {
    const res = await syncSubscription(sub);
    if (!res.ok) throw new Error(res.error ?? "sync fallita");
  }

  try {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await stripe().subscriptions.retrieve(session.subscription as string);
        if (!sub.metadata?.supabase_user_id && session.metadata?.supabase_user_id) {
          sub.metadata = { ...sub.metadata, ...session.metadata };
        }
        await upsertFromSubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await upsertFromSubscription(event.data.object as Stripe.Subscription);
      break;
    }

    // Ricevuta di addebito: ogni fattura pagata (canone e/o extra). L'importo è
    // stato realmente prelevato sulla carta salvata → mail con dettaglio.
    case "invoice.payment_succeeded": {
      try {
        const inv = event.data.object as unknown as {
          id: string; number?: string | null; customer: string;
          customer_email?: string | null; customer_name?: string | null;
          amount_paid: number; created: number;
          charge?: string | null; payment_intent?: string | null;
          status_transitions?: { paid_at?: number | null };
          lines?: { data?: { description?: string | null; amount?: number }[] };
        };
        if (!inv.amount_paid || inv.amount_paid <= 0) break; // niente da notificare (es. €0)

        // I soldi sono arrivati: si chiude il recupero. Va fatto prima di
        // qualsiasi altra cosa — se il banner "pagamento non riuscito" resta in
        // app a chi ha appena pagato, è peggio che non averlo mai messo.
        after(() => chiudiRecupero(inv.customer));

        // Registro fatturazione: la riga si scrive sempre, anche a ponte FIC
        // spento, così il giorno in cui si decide il regime fiscale gli incassi
        // già avvenuti sono tutti tracciati e non vanno ricostruiti da Stripe.
        // Fuori dal percorso sincrono: un problema con FIC non deve far fallire
        // il webhook e innescare i retry di Stripe sul pagamento.
        after(async () => {
          const { data: sub } = await db
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", inv.customer)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle<{ user_id: string | null }>();
          await registraIncasso({
            stripeInvoiceId: inv.id,
            stripeCustomerId: inv.customer,
            amountCents: inv.amount_paid,
            userId: sub?.user_id ?? null,
            descrizione: inv.lines?.data?.[0]?.description || "Abbonamento WashLoop",
            dataIso: new Date((inv.status_transitions?.paid_at ?? inv.created) * 1000).toISOString().slice(0, 10),
          });
        });

        // Destinatario: email da fattura, fallback al customer Stripe.
        let to = inv.customer_email ?? null;
        let name = inv.customer_name ?? null;
        if (!to) {
          const cust = (await stripe().customers.retrieve(inv.customer)) as Stripe.Customer;
          to = cust.email ?? null;
          name = name ?? cust.name ?? null;
        }
        // Nome cliente dal profilo (preferito), via stripe_customer_id.
        const { data: prof } = await db
          .from("subscriptions")
          .select("profiles(full_name)")
          .eq("stripe_customer_id", inv.customer)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ profiles: { full_name: string | null } | null }>();
        name = prof?.profiles?.full_name ?? name ?? "Cliente";
        if (!to) break;

        // Ultime 4 cifre della carta dal charge/payment_intent.
        let last4: string | null = null;
        try {
          if (inv.charge) {
            const ch = (await stripe().charges.retrieve(inv.charge)) as Stripe.Charge;
            last4 = ch.payment_method_details?.card?.last4 ?? null;
          } else if (inv.payment_intent) {
            const pi = await stripe().paymentIntents.retrieve(inv.payment_intent, { expand: ["latest_charge"] });
            const ch = pi.latest_charge as Stripe.Charge | null;
            last4 = ch?.payment_method_details?.card?.last4 ?? null;
          }
        } catch { /* last4 best-effort */ }

        const items = (inv.lines?.data ?? [])
          .filter((l) => typeof l.amount === "number")
          .map((l) => ({ description: l.description || "Servizio WashLoop", amount_cents: l.amount as number }));
        if (items.length === 0) items.push({ description: "Servizio WashLoop", amount_cents: inv.amount_paid });

        const paidAt = inv.status_transitions?.paid_at ?? inv.created;
        const html = chargeEmailHtml({
          fullName: name,
          items,
          totalCents: inv.amount_paid,
          cardLast4: last4,
          dateLabel: fmtDate(new Date(paidAt * 1000)),
          refLabel: inv.number ?? null,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it",
          legal: { company: LEGAL.company, vat: LEGAL.vat, address: LEGAL.address, email: LEGAL.email, phone: LEGAL.phone },
        });
        await sendMail({ to, subject: `Ricevuta WashLoop · €${(inv.amount_paid / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })} 🧾`, html });
      } catch (err) {
        console.error("[webhook] invoice.payment_succeeded notify fallita:", err);
      }
      break;
    }

    // Carta rifiutata. Prima non lo sapeva nessuno: l'abbonamento andava in
    // `past_due` su Stripe e il cliente lo scopriva aprendo l'app.
    //
    // Ora il fallimento lascia una traccia: l'URL della fattura rimasta aperta
    // (che paga in un tap, senza nemmeno accedere) e il contatore dei
    // solleciti. Da quella traccia vivono il banner in app e il cron che manda
    // il secondo e il terzo avviso.
    case "invoice.payment_failed": {
      const inv = event.data.object as unknown as {
        customer: string; customer_email?: string | null; customer_name?: string | null;
        amount_due?: number; hosted_invoice_url?: string | null;
      };
      after(async () => {
        try {
          const { data: sott } = await db
            .from("subscriptions")
            .select("id, user_id, dunning_step, profiles(full_name)")
            .eq("stripe_customer_id", inv.customer)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle<{ id: string; user_id: string; dunning_step: number | null; profiles: { full_name: string | null } | null }>();

          // L'URL va salvato comunque, anche se poi la notifica non parte: è il
          // link che l'operatore legge dalla scheda cliente per farsi pagare.
          if (sott) {
            await db
              .from("subscriptions")
              .update({
                last_failed_invoice_url: inv.hosted_invoice_url ?? null,
                last_failed_at: new Date().toISOString(),
              })
              .eq("id", sott.id);
          }

          let to = inv.customer_email ?? null;
          if (!to) {
            const cust = (await stripe().customers.retrieve(inv.customer)) as Stripe.Customer;
            to = cust.email ?? null;
          }

          if (!sott) {
            console.error(`[webhook] payment_failed: nessuna subscription per il customer ${inv.customer}`);
            return;
          }

          // Se un recupero è già in corso non si riparte da capo: Stripe
          // ritenta la stessa fattura più volte e ogni tentativo fa scattare
          // questo evento. Senza questo controllo il cliente riceverebbe il
          // primo sollecito tre o quattro volte, e il calendario non
          // avanzerebbe mai.
          if ((sott.dunning_step ?? 0) > 0) return;

          await inviaSollecito({
            subscriptionId: sott.id,
            step: 1,
            invoiceUrl: inv.hosted_invoice_url,
            destinatario: { userId: sott.user_id, email: to, nome: sott.profiles?.full_name ?? null },
          });
        } catch (err) {
          console.error("[webhook] invoice.payment_failed notify fallita:", err);
        }
      });
      break;
    }
  }

  } catch (err) {
    // La prenotazione dell'evento va rilasciata, altrimenti il tentativo
    // successivo di Stripe verrebbe scartato come duplicato e il dato andrebbe
    // perso comunque — esattamente il problema che stiamo chiudendo.
    await db.from("stripe_events").delete().eq("id", event.id);
    console.error(`[webhook] ${event.type} fallito:`, err);
    await registraGuasto("webhook", `Evento ${event.type} rifiutato: ${err instanceof Error ? err.message : "errore"}`, { event_id: event.id });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
