import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { registraGuasto } from "@/lib/incidenti";

/** Quello che succede quando un cliente registra la carta.
 *
 *  Tre gesti, tutti e tre dovuti, e nessuno da fare a mano:
 *
 *  1. la carta appena inserita diventa quella **predefinita** del cliente.
 *     Senza, l'incasso dei capi dovrebbe indovinare quale usare fra quelle
 *     attaccate, e `metodoDiPagamento` finirebbe a pescare la prima che trova;
 *  2. l'identificativo Stripe si scrive sul profilo — per un cliente a consumo
 *     non c'è nessuna riga in `subscriptions` dove tenerlo;
 *  3. **l'account si attiva**: ha messo la carta, quindi può prenotare. Lasciare
 *     quel passo a un interruttore in pannello voleva dire che un cliente che
 *     ha fatto tutto restava fermo finché qualcuno non se ne accorgeva.
 *
 *  Sta in un modulo suo perché la chiamano in due: il webhook, quando Stripe ci
 *  avvisa, e la pagina di ritorno del checkout, se il webhook non è ancora
 *  arrivato. È la stessa rete di sicurezza di `syncSubscription`, e per la
 *  stessa ragione: se si perde il primo, ci pensa il secondo.
 *
 *  Idempotente: rieseguirla non produce effetti diversi. */
export async function registraCartaDalCheckout(session: Stripe.Checkout.Session): Promise<void> {
  try {
    if (session.mode !== "setup") return;

    const cliente = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const userId = session.metadata?.supabase_user_id ?? null;

    if (session.setup_intent && cliente) {
      const si = await stripe().setupIntents.retrieve(
        typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent.id,
      );
      const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
      if (pm) {
        await stripe().customers.update(cliente, { invoice_settings: { default_payment_method: pm } });
      }
    }

    if (!userId) return;
    const svc = createServiceClient();
    const patch: Record<string, unknown> = {};
    if (cliente) patch.stripe_customer_id = cliente;
    // L'attivazione segue la carta solo se il link è nato per quello: un domani
    // un link di registrazione potrebbe servire a un abbonato che cambia carta,
    // e attivargli il consumo sarebbe un effetto che nessuno ha chiesto.
    if (session.metadata?.attiva_a_consumo === "1") patch.a_consumo = true;
    if (Object.keys(patch).length) await svc.from("profiles").update(patch).eq("id", userId);
  } catch (err) {
    // Non si lancia: la pagina di ringraziamento deve aprirsi comunque, e il
    // webhook non deve rispondere 500 su una cosa recuperabile a mano. Resta
    // scritto, così si scopre oggi e non al primo addebito.
    await registraGuasto("stripe", "Carta registrata ma non completata", {
      sessione: session.id,
      errore: err instanceof Error ? err.message : String(err),
    });
  }
}
