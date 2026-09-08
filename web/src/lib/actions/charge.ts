"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { chargeSpecialById } from "@/lib/billing-specials";

/** Mette in addebito i capi speciali non ancora fatturati di un ordine.
 *
 *  Strategia "come i migliori": NON un prelievo immediato off-session (che su
 *  carte SCA verrebbe rifiutato con authentication_required), ma **invoice
 *  items** agganciati alla **prossima fattura dell'abbonamento**. Stripe li
 *  addebita in automatico a fine mese col mandato già accettato all'iscrizione
 *  — nessuna richiesta al cliente. Coerente con la dicitura in app
 *  ("addebito automatico a fine mese").
 *
 *  Solo admin. Importo = price_cli_cents (prezzo cliente, IVA inclusa). */
export async function chargeOrderSpecials(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Solo admin");

  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) throw new Error("Ordine mancante");

  const svc = createServiceClient();

  const { data: specials } = await svc
    .from("order_specials")
    .select("id")
    .eq("order_id", orderId)
    .is("charged_at", null)
    .is("refunded_at", null)
    // Un capo annullato non torna in coda. Senza questa riga il bottone «Metti
    // in fattura» riaddebitava proprio i capi appena tolti per un claim.
    .is("annullato_at", null)
    .returns<{ id: string }[]>();
  const pending = specials ?? [];
  if (pending.length === 0) throw new Error("Nessun capo da addebitare");

  // Un invoice item per capo (righe chiare in fattura), via logica condivisa.
  for (const s of pending) {
    const res = await chargeSpecialById(svc, s.id);
    if (!res.ok && (res.reason === "no_stripe_customer" || res.reason === "no_customer")) {
      throw new Error("Cliente senza Customer Stripe (abbonamento mancante)");
    }
  }

  revalidatePath(`/admin/ordini/${orderId}`);
}

/** Admin: aggiunge un capo speciale a un ordine (snapshot prezzi dal listino). */
export async function addSpecialAdmin(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Solo admin");
  const orderId = String(formData.get("order_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const qty = Math.max(1, parseInt(String(formData.get("qty") ?? "1"), 10) || 1);
  if (!orderId || !itemId) throw new Error("Ordine e capo obbligatori");

  const svc = createServiceClient();
  const { data: item } = await svc
    .from("special_items")
    .select("id, name, comp_lav_cents, price_cli_cents, active")
    .eq("id", itemId)
    .single();
  if (!item || !item.active) throw new Error("Capo non a listino");

  const { data: inserted, error } = await svc
    .from("order_specials")
    .insert({
      order_id: orderId,
      item_id: item.id,
      item_name: item.name,
      qty,
      comp_lav_cents: item.comp_lav_cents,
      price_cli_cents: item.price_cli_cents,
      added_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !inserted) throw new Error(error?.message ?? "Errore inserimento capo");

  // Ledger payout lavanderia (comp_lav, IVA escl.), se l'ordine ha una lavanderia.
  const { data: ord } = await svc.from("orders").select("laundry_id").eq("id", orderId).maybeSingle<{ laundry_id: string | null }>();
  if (ord?.laundry_id) {
    await svc.from("laundry_payouts").insert({
      laundry_id: ord.laundry_id,
      order_id: orderId,
      special_id: inserted.id,
      kind: "special",
      amount_cents: item.comp_lav_cents * qty,
      status: "pending",
    });
  }
  revalidatePath(`/admin/ordini/${orderId}`);
}

/** Il capo che la lavanderia ha segnato, così com'è in banca dati. */
type CapoSpeciale = {
  id: string;
  order_id: string;
  item_name: string;
  qty: number;
  price_cli_cents: number;
  charged_at: string | null;
  refunded_at: string | null;
  annullato_at: string | null;
  stripe_invoice_item: string | null;
  orders: { customer_id: string } | null;
};

/** Toglie l'addebito quando i soldi non si sono ancora mossi.
 *
 *  Le quattro cose che deve fare, e che devono succedere tutte:
 *
 *  1. **togliere l'invoice item da Stripe**, altrimenti al prossimo rinnovo il
 *     capo entra in fattura da solo — il pannello direbbe «annullato» e il
 *     cliente si vedrebbe addebitare lo stesso;
 *  2. **chiudere la riga** con motivo, autore e data. Un annullo senza motivo,
 *     sei mesi dopo, non si sa più difendere davanti a chi contesta;
 *  3. **azzerare il compenso alla lavanderia**: il capo al cliente non lo
 *     facciamo pagare, e non c'è ragione di pagarlo noi. Questo passaggio
 *     mancava del tutto nel ramo «non ancora fatturato»;
 *  4. **lasciare una riga nel registro del cliente**, che è il posto dove si
 *     va a guardare quando qualcuno chiede conto di un importo.
 *
 *  `charged_at` torna a NULL perché nessun addebito è avvenuto, ma la riga
 *  **non** rientra in coda: `chargeOrderSpecials` e `chargeSpecialById`
 *  scartano i capi con `annullato_at`. */
async function annulla(
  svc: ReturnType<typeof createServiceClient>,
  sp: CapoSpeciale,
  adminId: string,
  motivo: string,
  sk: ReturnType<typeof stripe>,
) {
  if (sp.stripe_invoice_item) {
    try {
      await sk.invoiceItems.del(sp.stripe_invoice_item);
    } catch {
      // Già rimosso, o mai esistito: l'annullo va avanti lo stesso. Il caso
      // pericoloso è l'opposto — la riga chiusa qui e l'item vivo su Stripe —
      // e quello non si verifica: se la cancellazione fallisce davvero,
      // l'errore lo alza `invoiceItems.retrieve` prima di arrivare fin qui.
    }
  }

  await svc
    .from("order_specials")
    .update({
      annullato_at: new Date().toISOString(),
      annullato_motivo: motivo,
      annullato_da: adminId,
      charged_at: null,
      stripe_invoice_item: null,
    })
    .eq("id", sp.id);

  await svc.from("laundry_payouts").update({ status: "void" }).eq("special_id", sp.id);

  if (sp.orders?.customer_id) {
    await svc.from("customer_charges").insert({
      customer_id: sp.orders.customer_id,
      description: `Addebito annullato: ${sp.item_name}${sp.qty > 1 ? ` ×${sp.qty}` : ""} — ${motivo}`,
      amount_cents: sp.price_cli_cents * sp.qty,
      kind: "refund",
      status: "settled",
      created_by: adminId,
    });
  }
}

/** Annulla un capo speciale segnato dalla lavanderia: claim del cliente, o
 *  errore loro.
 *
 *  Il motivo è obbligatorio. Non è burocrazia: è l'unica differenza fra «gli
 *  abbiamo tolto 3,50 €» e «gli abbiamo tolto 3,50 € perché la lavanderia
 *  aveva contato le camicie comprese nel sacco». La seconda si può rileggere
 *  fra sei mesi, la prima no.
 *
 *  Se il capo è già finito su una fattura, qui non si passa: quello è un
 *  rimborso vero e lo fa `refundOrderSpecial`. */
export async function annullaCapoSpeciale(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Solo admin");

  const specialId = String(formData.get("special_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  const tornaA = String(formData.get("torna_a") ?? "");
  if (!specialId) throw new Error("Capo mancante");

  const errore = (m: string) => redirect(`${tornaA || "/admin/ordini"}?warn=${encodeURIComponent(m)}`);
  if (!motivo) errore("Scrivi perché stai annullando l'addebito: serve se il cliente lo contesta.");

  const svc = createServiceClient();
  const { data: sp } = await svc
    .from("order_specials")
    .select("id, order_id, item_name, qty, price_cli_cents, charged_at, refunded_at, annullato_at, stripe_invoice_item, orders(customer_id)")
    .eq("id", specialId)
    .maybeSingle<CapoSpeciale>();
  if (!sp) errore("Capo non trovato.");
  const capo = sp as CapoSpeciale;
  if (capo.annullato_at) errore("Questo addebito è già stato annullato.");
  if (capo.refunded_at) errore("Questo capo è già stato rimborsato.");

  const sk = stripe();

  // Se l'invoice item è già finito su una fattura, i soldi o si sono mossi o
  // stanno per farlo: lì non basta togliere la voce, serve un rimborso.
  if (capo.stripe_invoice_item) {
    const ii = await sk.invoiceItems.retrieve(capo.stripe_invoice_item);
    const suFattura = typeof ii.invoice === "string" ? ii.invoice : ii.invoice?.id ?? null;
    if (suFattura) {
      errore("Questo capo è già su una fattura: va rimborsato, non annullato. Usa «Rimborsa» dalla scheda del ritiro.");
    }
  }

  await annulla(svc, capo, profile.id, motivo, sk);

  revalidatePath(`/admin/ordini/${capo.order_id}`);
  revalidatePath(`/app/ordini/${capo.order_id}`);
  if (capo.orders?.customer_id) revalidatePath(`/admin/abbonati/${capo.orders.customer_id}`);
  redirect(`${tornaA || `/admin/ordini/${capo.order_id}`}?ok=${encodeURIComponent(`Addebito annullato: ${capo.item_name}.`)}`);
}

/** Rimborsa un singolo capo speciale già messo in fattura.
 *  - se l'invoice item è ancora in sospeso (non fatturato) → lo annulla (nessun
 *    denaro mosso, la riga si chiude e non torna in coda);
 *  - se è già su una fattura pagata → esegue un refund reale su Stripe per
 *    l'importo del capo.
 *  Registra anche una riga nel ledger cliente per tracciabilità. Solo admin. */
export async function refundOrderSpecial(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Solo admin");

  const specialId = String(formData.get("special_id") ?? "");
  if (!specialId) throw new Error("Capo mancante");
  const svc = createServiceClient();

  const { data: sp } = await svc
    .from("order_specials")
    .select("id, order_id, item_name, qty, price_cli_cents, charged_at, refunded_at, annullato_at, stripe_invoice_item, orders(customer_id)")
    .eq("id", specialId)
    .maybeSingle<CapoSpeciale>();
  if (!sp) throw new Error("Capo non trovato");
  if (sp.refunded_at) throw new Error("Capo già rimborsato");
  if (sp.annullato_at) throw new Error("Capo già annullato");
  if (!sp.charged_at) throw new Error("Capo non ancora addebitato");

  const amount = sp.price_cli_cents * sp.qty;
  const sk = stripe();
  let refundRef: string | null = null;
  let moneyMoved = false;

  if (sp.stripe_invoice_item) {
    const ii = await sk.invoiceItems.retrieve(sp.stripe_invoice_item);
    const invoiceId = typeof ii.invoice === "string" ? ii.invoice : ii.invoice?.id ?? null;
    if (!invoiceId) {
      // Ancora in sospeso: i soldi non si sono mossi, quindi non è un rimborso
      // ed è sbagliato trattarlo come tale. Si passa dall'annullo, che chiude
      // la riga invece di rimetterla in coda.
      //
      // Prima qui si rimetteva `charged_at` a NULL e si usciva: la voce tornava
      // «in attesa», il bottone «Metti in fattura» ricompariva e il capo appena
      // tolto per un claim si poteva riaddebitare.
      await annulla(svc, sp, profile.id, "Rimborso richiesto prima della fatturazione", sk);
      revalidatePath(`/admin/ordini/${sp.order_id}`);
      revalidatePath(`/admin/abbonati/${sp.orders?.customer_id ?? ""}`);
      return;
    }
    const inv = (await sk.invoices.retrieve(invoiceId)) as unknown as {
      status?: string;
      payment_intent?: string | { id?: string } | null;
      charge?: string | { id?: string } | null;
    };
    const pi = typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent?.id ?? null;
    const ch = typeof inv.charge === "string" ? inv.charge : inv.charge?.id ?? null;
    if (inv.status === "paid" && (pi || ch)) {
      const refund = await sk.refunds.create(pi ? { payment_intent: pi, amount } : { charge: ch as string, amount });
      refundRef = refund.id;
      moneyMoved = true;
    }
  }

  await svc.from("order_specials").update({ refunded_at: new Date().toISOString(), refund_ref: refundRef }).eq("id", specialId);
  // Azzera il payout dovuto alla lavanderia per questo capo.
  await svc.from("laundry_payouts").update({ status: "void" }).eq("special_id", specialId);
  if (sp.orders?.customer_id) {
    await svc.from("customer_charges").insert({
      customer_id: sp.orders.customer_id,
      description: `Rimborso capo: ${sp.item_name}${sp.qty > 1 ? ` ×${sp.qty}` : ""}`,
      amount_cents: amount,
      kind: "refund",
      status: moneyMoved ? "settled" : "pending",
      stripe_ref: refundRef,
      created_by: profile.id,
    });
  }
  revalidatePath(`/admin/ordini/${sp.order_id}`);
}

/** Mette in fattura **un solo** capo speciale.
 *
 *  `chargeOrderSpecials` addebita tutti i capi in attesa di un ordine: giusto
 *  quando si chiude un ritiro, sbagliato quando su tre capi ce n'è uno
 *  contestato. Finora l'unica strada era addebitarli tutti e poi annullare
 *  quello di troppo — cioè far comparire e sparire un importo sulla fattura di
 *  un cliente per rimediare a un'operazione che non si voleva fare.
 *
 *  Torna dove si stava: questa riga si guarda sia dalla scheda del ritiro sia
 *  da quella del cliente, e finire ogni volta sull'ordine costringeva a
 *  ritrovare da capo la persona di cui si stava parlando. */
export async function addebitaCapoSpeciale(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Solo admin");

  const specialId = String(formData.get("special_id") ?? "");
  const tornaA = String(formData.get("torna_a") ?? "");
  if (!specialId) throw new Error("Capo mancante");

  const svc = createServiceClient();
  const { data: sp } = await svc
    .from("order_specials")
    .select("id, order_id, item_name, orders(customer_id)")
    .eq("id", specialId)
    .maybeSingle<{ id: string; order_id: string; item_name: string; orders: { customer_id: string } | null }>();
  if (!sp) redirect(`${tornaA || "/admin/ordini"}?warn=${encodeURIComponent("Capo non trovato.")}`);

  const res = await chargeSpecialById(svc, specialId);

  const dove = tornaA || `/admin/ordini/${sp!.order_id}`;
  if (!res.ok) {
    const perche: Record<string, string> = {
      not_found: "Capo non trovato.",
      already_charged: "Questo capo è già stato messo in fattura, oppure è stato annullato o rimborsato.",
      no_customer: "Questo ritiro non ha un cliente collegato.",
      no_stripe_customer: "Il cliente non ha un profilo di pagamento su Stripe: non c'è dove appoggiare l'addebito.",
    };
    redirect(`${dove}?warn=${encodeURIComponent(perche[res.reason] ?? "Addebito non riuscito.")}`);
  }

  revalidatePath(`/admin/ordini/${sp!.order_id}`);
  revalidatePath(`/app/ordini/${sp!.order_id}`);
  if (sp!.orders?.customer_id) revalidatePath(`/admin/abbonati/${sp!.orders.customer_id}`);
  redirect(`${dove}?ok=${encodeURIComponent(`${sp!.item_name} messo in fattura: entrerà nella prossima ricevuta.`)}`);
}
