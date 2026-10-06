import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { stripe, siteUrl } from "@/lib/stripe";
import { registraGuasto } from "@/lib/incidenti";
import { sendMail, renderEmail } from "@/lib/email";
import { normalizzaCodice, premioSpettante, valoreSettimana } from "@/lib/invito";

/** Porta un amico: la parte che tocca il database e Stripe.
 *
 *  Le regole stanno in `invito.ts`, che è puro e collaudato. Qui c'è solo il
 *  giro: chi ha invitato chi, quando matura il premio, e come si trasforma in
 *  un credito vero. */

/** Chi ha invitato questo cliente, se qualcuno l'ha invitato. */
export async function registraInvito(userId: string, codiceGrezzo: string | null | undefined): Promise<void> {
  try {
    const codice = normalizzaCodice(codiceGrezzo);
    if (!userId || !codice) return;

    const svc = createServiceClient();
    const [{ data: io }, { data: invitante }] = await Promise.all([
      svc.from("profiles").select("id, client_code, invitato_da").eq("id", userId).maybeSingle<{ id: string; client_code: string | null; invitato_da: string | null }>(),
      svc.from("profiles").select("id").eq("client_code", codice).maybeSingle<{ id: string }>(),
    ]);

    // Si scrive una volta sola. L'invito è un fatto del giorno dell'iscrizione:
    // se si potesse riscrivere, basterebbe tornare su un altro link il mese dopo
    // per spostare il premio a qualcun altro.
    if (!io || io.invitato_da) return;
    if (!invitante) return;
    if (invitante.id === userId) return; // nessuno si invita da solo
    if (io.client_code && io.client_code.toUpperCase() === codice) return;

    await svc
      .from("profiles")
      .update({ invitato_da: invitante.id, invitato_il: new Date().toISOString() })
      .eq("id", userId)
      .is("invitato_da", null);
  } catch (err) {
    // Non si lancia mai: un invito perso è un peccato, un'iscrizione che fallisce
    // per colpa di un invito è molto peggio.
    console.error(`[invito] registrazione fallita per ${userId}:`, err);
  }
}

/** Il canone mensile di un cliente, o `null` se non ne ha uno vivo. */
async function canoneDi(svc: ReturnType<typeof createServiceClient>, userId: string): Promise<number | null> {
  const { data } = await svc
    .from("subscriptions")
    .select("custom_price_cents, termina_dopo_settimane, plans(price_month_cents)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      custom_price_cents: number | null;
      termina_dopo_settimane: number | null;
      plans: { price_month_cents: number } | { price_month_cents: number }[] | null;
    }>();
  if (!data) return null;
  // Un pacchetto a termine non è un canone mensile: dividerlo per quattro
  // darebbe una «settimana» che non significa niente.
  if (data.termina_dopo_settimane) return null;
  const piano = Array.isArray(data.plans) ? data.plans[0] : data.plans;
  return data.custom_price_cents ?? piano?.price_month_cents ?? null;
}

/** Il premio, quando l'amico compra davvero.
 *
 *  Si chiama dal webhook, sul **primo** pagamento di un abbonamento e non sui
 *  rinnovi: la regola di Simone è «una settimana con l'acquisto, non con il
 *  rinnovo». La riga in `referral_premi` ha `invitato_id` unico, quindi anche
 *  se questa funzione venisse chiamata due volte il premio resta uno. */
export async function assegnaPremioSeDovuto(invitatoId: string | null | undefined): Promise<void> {
  try {
    if (!invitatoId) return;
    const svc = createServiceClient();

    const { data: io } = await svc
      .from("profiles")
      .select("id, full_name, invitato_da")
      .eq("id", invitatoId)
      .maybeSingle<{ id: string; full_name: string | null; invitato_da: string | null }>();
    if (!io?.invitato_da) return;

    const { data: gia } = await svc
      .from("referral_premi")
      .select("id")
      .eq("invitato_id", invitatoId)
      .maybeSingle<{ id: string }>();
    if (gia) return;

    const canone = await canoneDi(svc, io.invitato_da);
    const esito = premioSpettante({
      invitanteId: io.invitato_da,
      invitatoId,
      canoneInvitanteCents: canone,
    });
    if (!esito.spetta) return;

    const { data: riga, error } = await svc
      .from("referral_premi")
      .insert({
        invitante_id: io.invitato_da,
        invitato_id: invitatoId,
        stato: esito.stato,
        valore_cents: esito.valoreCents,
        motivo: esito.motivo,
      })
      .select("id")
      .single<{ id: string }>();
    // 23505 = l'indice unico ha fatto il suo lavoro: il premio c'era già.
    if (error) {
      if ((error as { code?: string }).code !== "23505") throw new Error(error.message);
      return;
    }

    if (esito.stato === "maturato") {
      await accreditaPremio(riga.id);
    }
    await avvisaInvitante(io.invitato_da, io.full_name, esito.stato === "maturato" ? esito.valoreCents : 0);
  } catch (err) {
    await registraGuasto("stripe", "Premio «porta un amico» non assegnato", {
      invitato: invitatoId ?? "—",
      errore: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Trasforma il premio in un credito vero su Stripe.
 *
 *  Un credito sul saldo del cliente, non un coupon: Stripe lo scala da solo
 *  dalla prima fattura utile, non tocca la data di rinnovo e non lascia in giro
 *  codici sconto da ricordarsi. */
export async function accreditaPremio(premioId: string): Promise<{ ok: boolean; errore?: string }> {
  const svc = createServiceClient();
  const { data: premio } = await svc
    .from("referral_premi")
    .select("id, invitante_id, valore_cents, stato")
    .eq("id", premioId)
    .maybeSingle<{ id: string; invitante_id: string; valore_cents: number; stato: string }>();
  if (!premio) return { ok: false, errore: "Premio non trovato" };
  if (premio.stato === "accreditato") return { ok: true };

  // Il valore si ricalcola adesso se la riga era rimasta sospesa: nel frattempo
  // il cliente può aver attivato un abbonamento, ed è il caso per cui esiste il
  // bottone «accredita» in pannello.
  const valore = premio.valore_cents > 0 ? premio.valore_cents : valoreSettimana(await canoneDi(svc, premio.invitante_id));
  if (valore <= 0) return { ok: false, errore: "Chi ha invitato non ha ancora un canone su cui calcolare la settimana." };

  const cliente = await clienteStripeDi(svc, premio.invitante_id);
  if (!cliente) return { ok: false, errore: "Chi ha invitato non ha un profilo di pagamento su Stripe." };

  try {
    const tx = await stripe().customers.createBalanceTransaction(cliente, {
      amount: -valore,
      currency: "eur",
      description: "WashLoop · una settimana in regalo (porta un amico)",
    });
    await svc
      .from("referral_premi")
      .update({ stato: "accreditato", valore_cents: valore, stripe_balance_tx: tx.id, accreditato_at: new Date().toISOString(), motivo: null })
      .eq("id", premioId);
    return { ok: true };
  } catch (err) {
    const errore = err instanceof Error ? err.message : String(err);
    await svc.from("referral_premi").update({ stato: "sospeso", motivo: errore }).eq("id", premioId);
    return { ok: false, errore };
  }
}

/** Il cliente Stripe di una persona: sta su `subscriptions` per gli abbonati e
 *  sul profilo per chi non ne ha mai avuto uno. */
async function clienteStripeDi(svc: ReturnType<typeof createServiceClient>, userId: string): Promise<string | null> {
  const { data: sub } = await svc
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  if (sub?.stripe_customer_id) return sub.stripe_customer_id;
  const { data: prof } = await svc
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  return prof?.stripe_customer_id ?? null;
}

const eur = (c: number) => "€" + (c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 });

async function avvisaInvitante(invitanteId: string, nomeAmico: string | null, valoreCents: number): Promise<void> {
  try {
    if (valoreCents <= 0) return; // premio sospeso: lo gestisce l'ops, non si promette niente
    const svc = createServiceClient();
    const { data: utente } = await svc.auth.admin.getUserById(invitanteId);
    const to = utente?.user?.email;
    if (!to) return;
    const amico = (nomeAmico ?? "").trim().split(/\s+/)[0] || "Un tuo amico";
    const html = renderEmail({
      title: "La tua settimana è arrivata 🎁",
      emoji: "🎁",
      preheader: `${amico} si è iscritto grazie a te.`,
      body: `<p><strong>${amico}</strong> si è iscritto a WashLoop con il tuo invito, e ha appena attivato il suo abbonamento.</p>
<p>Come promesso una settimana è tua: <strong>${eur(valoreCents)}</strong> scalati in automatico dalla tua prossima fattura. Non devi fare niente.</p>
<p>Grazie: i clienti che arrivano da un amico sono quelli che restano di più.</p>`,
      cta: { label: "Porta un altro amico", href: `${siteUrl()}/app/invita` },
    });
    await sendMail({ to, subject: "La tua settimana è arrivata 🎁", html });
  } catch (err) {
    console.error(`[invito] avviso a ${invitanteId} non inviato:`, err);
  }
}
