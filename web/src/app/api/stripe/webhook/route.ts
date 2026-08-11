import { NextResponse, after, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { eventoGiaVisto, syncSubscription } from "@/lib/subscription-sync";
import { renderEmail, sendMail } from "@/lib/email";
import { chargeEmailHtml } from "@/lib/email-templates";
import { LEGAL } from "@/lib/legal";
import { fmtDate } from "@/lib/format";

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
        await sendMail({ to, subject: `Addebito WashLoop · €${(inv.amount_paid / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })} 💳`, html });
      } catch (err) {
        console.error("[webhook] invoice.payment_succeeded notify fallita:", err);
      }
      break;
    }

    // Carta rifiutata. Prima non lo sapeva nessuno: l'abbonamento andava in
    // `past_due` su Stripe e il cliente lo scopriva aprendo l'app.
    case "invoice.payment_failed": {
      const inv = event.data.object as unknown as {
        customer: string; customer_email?: string | null; customer_name?: string | null; amount_due?: number;
      };
      after(async () => {
        try {
          let to = inv.customer_email ?? null;
          if (!to) {
            const cust = (await stripe().customers.retrieve(inv.customer)) as Stripe.Customer;
            to = cust.email ?? null;
          }
          if (!to) return;
          const { data: prof } = await db
            .from("subscriptions")
            .select("profiles(full_name)")
            .eq("stripe_customer_id", inv.customer)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle<{ profiles: { full_name: string | null } | null }>();
          const nome = prof?.profiles?.full_name?.split(" ")[0] ?? "";
          await sendMail({
            to,
            subject: "Pagamento non riuscito — il servizio resta in pausa",
            html: renderEmail({
              title: `Pagamento non riuscito${nome ? `, ${nome}` : ""}`,
              emoji: "💳",
              preheader: "Aggiorna il metodo di pagamento per riattivare i ritiri.",
              body: `Non siamo riusciti ad addebitare il canone WashLoop. Nessun problema: aggiorna il metodo di pagamento dall'area personale e i ritiri riprendono subito. Se pensi sia un errore, rispondi a questa email.`,
              cta: { label: "Aggiorna pagamento", href: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it"}/app/abbonamento` },
            }),
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
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
