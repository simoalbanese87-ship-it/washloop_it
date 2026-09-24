import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe, siteUrl } from "@/lib/stripe";
import { creaClienteStripe, allineaClienteStripe } from "@/lib/stripe-customer";
import { METODI_CHECKOUT } from "@/lib/metodi-accettati";
import { paracadute, tetto } from "@/lib/prova";

/**
 * Crea/recupera il customer Stripe per l'utente loggato e apre una sessione
 * di Checkout per il piano indicato. Ritorna l'URL di Stripe.
 * Riusata sia dal form abbonamento sia dal flusso Attiva → iscrizione → pay.
 */
export async function checkoutUrlForPlan(planId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?mode=signup");

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, stripe_price_id, prova_giorni")
    .eq("id", planId)
    .single();
  if (!plan?.stripe_price_id) throw new Error("Prezzo Stripe non configurato per questo piano");

  // La prova gratuita, se questo piano ce l'ha e se questa persona non l'ha già
  // usata. La seconda condizione è l'unica cosa che impedisce di entrare gratis
  // per sempre disdicendo e riscrivendosi.
  const { data: io } = await supabase
    .from("profiles")
    .select("prova_usata_at")
    .eq("id", user.id)
    .maybeSingle<{ prova_usata_at: string | null }>();
  const giorniProva = io?.prova_usata_at ? 0 : plan.prova_giorni ?? 0;

  // Recupera eventuale customer esistente
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id as string | undefined;
  if (!customerId) {
    // Anagrafica completa fin dalla creazione: nome, telefono e indirizzo li
    // abbiamo già, e su Stripe servono per ricevute e riconciliazione.
    const customer = await creaClienteStripe(supabase, user.id, user.email ?? undefined);
    customerId = customer.id;
  } else {
    // I clienti creati prima hanno su Stripe la sola email: li riallineiamo al
    // passaggio successivo, senza far pesare un errore sul pagamento.
    await allineaClienteStripe(supabase, user.id, customerId);
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    // Carta (+ Apple/Google Pay), Link, Amazon Pay. La lista e il perché stanno
    // in `lib/metodi-accettati.ts`: scritta qui sarebbe da cambiare in due posti.
    payment_method_types: [...METODI_CHECKOUT],
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    // Pagina di conferma dedicata (conversione Google Ads). {CHECKOUT_SESSION_ID}
    // è sostituito da Stripe → serve per deduplicare la conversione.
    success_url: `${siteUrl()}/checkout/grazie?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/app/abbonamento?checkout=cancel`,
    // Esplicito anche se è già il comportamento di `mode: subscription`: con una
    // prova a 0 € la riga «la carta si prende comunque» è la più importante di
    // tutta questa chiamata, e va scritta dove si legge.
    payment_method_collection: "always",
    metadata: { supabase_user_id: user.id, plan_id: plan.id },
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        plan_id: plan.id,
        // Il tetto viaggia di qui perché al checkout la riga in `subscriptions`
        // non esiste ancora: la crea il webhook. Stessa strada già usata per
        // supabase_user_id e custom_price_cents, nessun percorso nuovo e
        // nessuna finestra in cui il muro non esiste.
        ...(giorniProva > 0 ? { prova_tetto_at: tetto(new Date().toISOString()) } : {}),
      },
      ...(giorniProva > 0
        ? {
            // `trial_end` assoluto e non `trial_period_days`: il primo torna
            // indietro da Stripe (`sub.trial_end`) e questa data si muove,
            // quindi dev'essere rileggibile. Il secondo no.
            //
            // E soprattutto: la prova nasce **già con una fine**. Se qualcosa
            // più avanti si rompe, il peggio che capita è che il cliente abbia
            // avuto gratis la finestra di prenotazione.
            trial_end: Math.floor(Date.parse(paracadute(new Date().toISOString(), giorniProva)) / 1000),
            // Se a fine prova la carta non c'è, l'abbonamento si chiude invece
            // di restare `trialing` per sempre.
            trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } },
          }
        : {}),
    },
  });

  if (!session.url) throw new Error("Stripe non ha restituito un URL di checkout");
  return session.url;
}
