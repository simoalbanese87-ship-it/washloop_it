"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripe, siteUrl } from "@/lib/stripe";
import { creaClienteStripe, allineaClienteStripe } from "@/lib/stripe-customer";
import { METODI_CHECKOUT } from "@/lib/metodi-accettati";
import { prezzoUltimoRitiro } from "@/lib/saldo-gettoni";
import { notifyVuoleAbbonamento } from "@/lib/notify";

/** Il cliente ricompra un ritiro da solo.
 *
 *  Chi ha finito i ritiri comprati non deve aspettare che qualcuno gli mandi
 *  un link: è la differenza fra «ne prendo un altro» e «ci penso». Il prezzo
 *  **non** è quello di listino: è quello che ha pagato l'ultima volta, cioè
 *  quello concordato con lui — ritrovarne uno diverso sarebbe un aumento mai
 *  annunciato.
 *
 *  Non crea nessun abbonamento, come il link che gli ha mandato l'ops: paga,
 *  e il webhook gli accredita il ritiro. */
export async function compraUnRitiro() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const prezzo = await prezzoUltimoRitiro(svc, user.id);
  // Senza un prezzo già concordato non si inventa una cifra: si passa da chi
  // quel prezzo lo decide.
  if (!prezzo || prezzo <= 0) redirect("/app/abbonamento?ritiro=prezzo");

  const { data: existing } = await svc
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  const { data: prof } = await svc
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  let customerId = existing?.stripe_customer_id ?? prof?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const c = await creaClienteStripe(svc, user.id, user.email ?? undefined);
    customerId = c.id;
    await svc.from("profiles").update({ stripe_customer_id: c.id }).eq("id", user.id);
  } else {
    await allineaClienteStripe(svc, user.id, customerId);
  }

  const descrizione = "WashLoop · 1 ritiro";
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    payment_method_types: [...METODI_CHECKOUT],
    line_items: [{ quantity: 1, price_data: { currency: "eur", product_data: { name: descrizione }, unit_amount: prezzo } }],
    payment_intent_data: { setup_future_usage: "off_session" },
    success_url: `${siteUrl()}/app/prenota?ritiro=comprato`,
    cancel_url: `${siteUrl()}/app?pagamento=annullato`,
    metadata: { supabase_user_id: user.id, una_tantum: "1", descrizione, gettoni: "1" },
  });
  if (!session.url) throw new Error("Stripe non ha restituito un link");

  // La proposta si registra come quelle fatte dall'ops: è da qui che
  // `prezzoUltimoRitiro` leggerà il prezzo la volta dopo, e senza la riga il
  // secondo riacquisto non saprebbe più quanto costa.
  await svc.from("subscription_offers").insert({
    user_id: user.id,
    description: descrizione,
    amount_cents: prezzo,
    checkout_url: session.url,
    checkout_session_id: session.id,
    expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    una_tantum: true,
    gettoni: 1,
  });

  redirect(session.url);
}

/** «Voglio l'abbonamento»: una richiesta, non un acquisto.
 *
 *  L'abbonamento ha un prezzo che si concorda, quindi questo bottone non può
 *  incassare niente: avvisa chi quel prezzo lo decide. Per il cliente è un
 *  gesto solo, e per noi è una persona che ha alzato la mano. */
export async function chiediAbbonamento() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await notifyVuoleAbbonamento(user.id);
  redirect("/app/abbonamento?richiesta=1");
}
