import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { registraCartaDalCheckout } from "@/lib/carta-registrata";

/** Scrive su `subscriptions` lo stato reale di un abbonamento Stripe.
 *
 *  Sta qui e non dentro il webhook perché serve a DUE percorsi:
 *  1. il webhook, quando Stripe ci chiama;
 *  2. la pagina di ritorno del checkout, quando il webhook non è ancora
 *     arrivato o è fallito.
 *
 *  Prima esisteva solo il primo. Se il webhook si perdeva, il cliente aveva
 *  pagato, la pagina gli diceva "abbonamento attivo" e poi l'app lo rimandava a
 *  comprare un piano. È idempotente: rieseguirla non produce effetti diversi. */
/** Stripe: `current_period_end` è top-level nelle vecchie API, sugli items
 *  nelle nuove. Serve in due punti, e due copie divergerebbero al primo
 *  aggiornamento della libreria. */
function periodEndDi(sub: Stripe.Subscription): number | undefined {
  return (
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end
  );
}

export async function syncSubscription(sub: Stripe.Subscription): Promise<{ ok: boolean; error?: string }> {
  const db = createServiceClient();

  const userId = sub.metadata?.supabase_user_id;
  if (!userId) return { ok: false, error: "subscription senza supabase_user_id nei metadata" };

  const planId = sub.metadata?.plan_id ?? null;
  const periodEnd = periodEndDi(sub);

  const row: Record<string, unknown> = {
    user_id: userId,
    plan_id: planId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    status: sub.status,
    // Stripe lo sa e noi lo buttavamo via a ogni sincronizzazione: un
    // abbonamento disdetto a fine periodo su Stripe è `active`, quindi
    // riscrivendo solo lo stato la disdetta spariva e il bottone «Disdici»
    // ricompariva pochi secondi dopo essere stato premuto.
    cancel_at_period_end: sub.cancel_at_period_end === true,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    // La data dell'addebito la tiene Stripe; questa è la copia, riallineata a
    // ogni webhook. Così anche una modifica fatta a mano dalla dashboard arriva
    // in app, e non esiste un percorso in cui la data che mostriamo al cliente
    // è diversa da quella su cui Stripe incassa davvero.
    prova_fine_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
  };
  // Il tetto arriva dal checkout nei metadata e non si tocca mai più: è
  // congelato alla creazione apposta. Si scrive solo se non c'è già.
  const tettoDaiMetadata = sub.metadata?.prova_tetto_at;
  if (tettoDaiMetadata) row.prova_tetto_at = tettoDaiMetadata;
  const customCents = sub.metadata?.custom_price_cents ? parseInt(sub.metadata.custom_price_cents, 10) : NaN;
  if (Number.isFinite(customCents)) row.custom_price_cents = customCents;
  // Prova a pagamento: la durata arriva dai metadata e non cambia mai più.
  const settimane = sub.metadata?.termina_dopo_settimane
    ? parseInt(sub.metadata.termina_dopo_settimane, 10)
    : NaN;
  if (Number.isFinite(settimane) && settimane > 0) row.termina_dopo_settimane = settimane;

  // L'errore va guardato: prima veniva ignorato e la route rispondeva comunque
  // 200, quindi Stripe considerava l'evento consegnato e il dato spariva.
  const { error } = await db.from("subscriptions").upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) return { ok: false, error: error.message };

  if (["active", "trialing"].includes(sub.status)) {
    await db.from("subscriptions")
      .update({ activated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", sub.id)
      .is("activated_at", null);
    // I sacchi concordati al momento del link, scritti **solo se la colonna è
    // ancora vuota**: erano un campo che qualcuno doveva compilare a mano dopo
    // il pagamento, cioè il passaggio che salta quando le prove sono cento.
    // Scriverli a ogni sincronizzazione cancellerebbe le correzioni fatte in
    // pannello al primo evento Stripe che passa.
    const sacchi = sub.metadata?.bags_per_week ? parseInt(sub.metadata.bags_per_week, 10) : NaN;
    if (Number.isFinite(sacchi) && sacchi > 0) {
      await db.from("subscriptions")
        .update({ bags_per_week: sacchi })
        .eq("stripe_subscription_id", sub.id)
        .is("bags_per_week", null);
    }
    // L'abbonamento a termine si chiude da solo: un ciclo, e via. Stripe
    // Checkout non accetta `cancel_at` fra i dati della subscription, quindi
    // la disdetta si mette qui, subito dopo la nascita.
    //
    // Sta in questa funzione e non nel webhook perché è l'imbuto di TUTTI i
    // percorsi — webhook, pagina di ritorno, eventi successivi: se il primo si
    // perde, ci pensa il successivo. E `termine_applicato` è il freno: senza,
    // l'aggiornamento qui sotto rientrerebbe da `customer.subscription.updated`
    // e ogni «Riprendi» premuto in pannello verrebbe annullato dal sync dopo.
    if (row.termina_dopo_settimane && !sub.cancel_at_period_end && !sub.metadata?.termine_applicato) {
      try {
        const aggiornato = await stripe().subscriptions.update(sub.id, {
          cancel_at_period_end: true,
          metadata: { ...sub.metadata, termine_applicato: "1" },
        });
        await db.from("subscriptions")
          .update({ cancel_at_period_end: aggiornato.cancel_at_period_end === true })
          .eq("stripe_subscription_id", sub.id);
      } catch (err) {
        // Non si ingoia: senza disdetta il cliente riceve un secondo addebito
        // che non ha chiesto, ed è esattamente ciò che questo disegno evita.
        return { ok: false, error: err instanceof Error ? err.message : "disdetta a fine ciclo non impostata" };
      }
    }
    // La prova si consuma qui, la prima volta che se ne vede una. Senza questa
    // riga, disdire durante la prova e riscriversi darebbe un'altra settimana
    // gratis ogni volta: è l'unico modo di entrare gratis per sempre che questo
    // disegno lascerebbe aperto.
    if (sub.status === "trialing") {
      await db.from("profiles")
        .update({ prova_usata_at: new Date().toISOString() })
        .eq("id", userId)
        .is("prova_usata_at", null);
    }
    // `canceled_at` si azzera solo se la disdetta non è nemmeno programmata:
    // è la data in cui è stata **chiesta**, e su un abbonamento che finisce a
    // fine periodo quella data esiste eccome.
    if (!sub.cancel_at_period_end) {
      await db.from("subscriptions").update({ canceled_at: null }).eq("stripe_subscription_id", sub.id);
    }
  } else if (sub.status === "canceled") {
    await db.from("subscriptions")
      .update({ canceled_at: new Date().toISOString() })
      .eq("stripe_subscription_id", sub.id)
      .is("canceled_at", null);
  }

  return { ok: true };
}

/** Rete di sicurezza del ritorno da Checkout: se il webhook non è ancora
 *  passato, allinea l'abbonamento leggendo la sessione direttamente da Stripe.
 *  Non lancia mai: la pagina di ringraziamento deve aprirsi comunque. */
export async function syncFromCheckoutSession(
  sessionId: string,
): Promise<{ attivo: boolean; prova: { fineIso: string } | null; incassatoCents: number; unaTantum: boolean; finisceIso: string | null; cartaRegistrata: boolean }> {
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    // Pagamento singolo: non c'è nessun abbonamento da allineare, e dire «stiamo
    // completando l'attivazione» a chi ha appena pagato una settimana sarebbe
    // una bugia — non è in corso niente, e non deve aspettare nulla.
    // Registrazione della carta: non è stato addebitato niente, e dire «pagato»
    // a chi non ha pagato sarebbe la cosa più sbagliata da scrivere qui.
    if (session.mode === "setup") {
      // Rete di sicurezza come per gli abbonamenti: se il webhook non è ancora
      // passato, l'account si attiva da qui. Senza, il cliente leggerebbe
      // «puoi prenotare» e poi si troverebbe la porta chiusa.
      if (session.status === "complete") await registraCartaDalCheckout(session);
      return { attivo: false, prova: null, incassatoCents: 0, unaTantum: false, finisceIso: null, cartaRegistrata: session.status === "complete" };
    }
    if (session.mode === "payment") {
      const pagato = session.payment_status === "paid";
      return {
        attivo: false,
        prova: null,
        incassatoCents: pagato ? session.amount_total ?? 0 : 0,
        unaTantum: pagato,
        finisceIso: null,
        cartaRegistrata: false,
      };
    }
    // Con una prova a 0 € la sessione si completa senza `payment_status: paid`:
    // guardare solo il pagamento avrebbe fatto dire «non attivo» a ogni prova.
    if (session.payment_status !== "paid" && session.status !== "complete") return { attivo: false, prova: null, incassatoCents: 0, unaTantum: false, finisceIso: null, cartaRegistrata: false };
    if (!session.subscription) return { attivo: false, prova: null, incassatoCents: 0, unaTantum: false, finisceIso: null, cartaRegistrata: false };

    const sub = await stripe().subscriptions.retrieve(session.subscription as string);
    // I metadata stanno sulla sessione quando la subscription è appena nata.
    if (!sub.metadata?.supabase_user_id && session.metadata?.supabase_user_id) {
      sub.metadata = { ...sub.metadata, ...session.metadata };
    }
    const res = await syncSubscription(sub);
    if (!res.ok) console.error("[checkout] sync fallita:", res.error);
    return {
      attivo: ["active", "trialing"].includes(sub.status),
      prova:
        sub.status === "trialing" && sub.trial_end
          ? { fineIso: new Date(sub.trial_end * 1000).toISOString() }
          : null,
      // Quanto è stato incassato **adesso**, per la conversione pubblicitaria.
      // Su una prova gratuita è zero, ed è giusto: non è ancora un acquisto, e
      // dichiararlo a Meta al prezzo del piano falserebbe il costo per
      // acquisizione di ogni campagna.
      incassatoCents: session.amount_total ?? 0,
      unaTantum: false,
      cartaRegistrata: false,
      // Abbonamento a termine: la data in cui si chiude da solo. Dirla subito
      // è l'unico modo perché «attivo» non suoni come «ti addebiteremo ancora».
      finisceIso: sub.metadata?.termina_dopo_settimane && periodEndDi(sub)
        ? new Date(periodEndDi(sub)! * 1000).toISOString()
        : null,
    };
  } catch (err) {
    console.error("[checkout] impossibile verificare la sessione:", err);
    return { attivo: false, prova: null, incassatoCents: 0, unaTantum: false, finisceIso: null, cartaRegistrata: false };
  }
}

/** Evento già processato? Stripe ritenta per 3 giorni: senza questo controllo la
 *  ricevuta di addebito partiva a ogni tentativo. */
export async function eventoGiaVisto(eventId: string, type: string): Promise<boolean> {
  const db = createServiceClient();
  const { error } = await db.from("stripe_events").insert({ id: eventId, type });
  // 23505 = chiave duplicata → l'abbiamo già gestito.
  if (error && (error as { code?: string }).code === "23505") return true;
  return false;
}
