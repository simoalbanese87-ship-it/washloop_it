"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { chargeSpecialById } from "@/lib/billing-specials";
import { notifySpecialAdded } from "@/lib/notify";

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

  // Il cliente si avvisa qui, dove l'importo diventa suo: prima la mail partiva
  // al momento in cui la lavanderia registrava il capo, cioè prima che qualcuno
  // avesse guardato il prezzo.
  if (res.ok) {
    try {
      await notifySpecialAdded(res.customerId, { itemName: res.itemName, priceCents: res.priceCents, orderId: sp!.order_id });
    } catch (err) {
      console.error(`[charge] notifica capo ${specialId} non inviata:`, err);
    }
  }

  revalidatePath(`/admin/ordini/${sp!.order_id}`);
  revalidatePath(`/app/ordini/${sp!.order_id}`);
  revalidatePath("/admin/extra");
  if (sp!.orders?.customer_id) revalidatePath(`/admin/abbonati/${sp!.orders.customer_id}`);
  redirect(`${dove}?ok=${encodeURIComponent(`${sp!.item_name} messo in fattura: entrerà nella prossima ricevuta.`)}`);
}

/** Corregge a mano i due prezzi di un capo speciale non ancora addebitato.
 *
 *  Perché serve, e perché solo prima dell'addebito
 *  -----------------------------------------------
 *  Ogni capo porta con sé la fotografia dei prezzi di quando è stato
 *  registrato. È il comportamento giusto: un importo comunicato al cliente non
 *  deve cambiargli sotto i piedi. Ma se il listino cambia dopo — o se il
 *  listino era sbagliato, com'è stato per la camicia a 3,00 quando il contratto
 *  dice 2,05 — quella fotografia resta vecchia, e finora l'unico modo di
 *  correggerla era togliere il capo e rifarlo dalla scheda del ritiro.
 *
 *  Finché nessuno ha pagato niente, quel numero è ancora una nostra bozza e si
 *  deve poter correggere. Dal momento in cui è in fattura non si tocca più: lì
 *  esiste un cliente che ha visto un importo e una lavanderia che ha maturato
 *  un compenso, e riscrivere sotto è come cambiare una ricevuta già data.
 *
 *  La riga del compenso lavanderia segue, se è ancora da pagare. */
export async function correggiPrezzoCapo(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Solo admin");

  const specialId = String(formData.get("special_id") ?? "");
  const tornaA = String(formData.get("torna_a") ?? "/admin/extra");
  const errore = (m: string) => redirect(`${tornaA}?warn=${encodeURIComponent(m)}`);
  if (!specialId) errore("Capo mancante.");

  const inCentesimi = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100);
  const prezzoCli = inCentesimi(String(formData.get("price_cli_eur") ?? ""));
  const compLav = inCentesimi(String(formData.get("comp_lav_eur") ?? ""));
  if (!Number.isFinite(prezzoCli) || prezzoCli < 0) errore("Il prezzo al cliente non è un numero valido.");
  if (!Number.isFinite(compLav) || compLav < 0) errore("Il compenso alla lavanderia non è un numero valido.");

  const svc = createServiceClient();
  const { data: sp } = await svc
    .from("order_specials")
    .select("id, order_id, item_name, qty, charged_at, refunded_at, annullato_at, orders(customer_id)")
    .eq("id", specialId)
    .maybeSingle<{ id: string; order_id: string; item_name: string; qty: number; charged_at: string | null; refunded_at: string | null; annullato_at: string | null; orders: { customer_id: string } | null }>();
  if (!sp) errore("Capo non trovato.");
  if (sp!.charged_at) errore("Questo capo è già in fattura: il prezzo non si riscrive più. Se è sbagliato va rimborsato e rifatto.");
  if (sp!.refunded_at || sp!.annullato_at) errore("Questo capo è chiuso: non c'è un prezzo da correggere.");

  const { error } = await svc
    .from("order_specials")
    .update({ price_cli_cents: prezzoCli, comp_lav_cents: compLav })
    .eq("id", specialId);
  if (error) errore(error.message);

  // Il compenso alla lavanderia segue il prezzo, ma solo se non è già uscito
  // dal conto: una cifra bonificata è concordata e non si riscrive.
  await svc
    .from("laundry_payouts")
    .update({ amount_cents: compLav * sp!.qty })
    .eq("special_id", specialId)
    .eq("status", "pending")
    .is("paid_at", null);

  revalidatePath("/admin/extra");
  revalidatePath(`/admin/ordini/${sp!.order_id}`);
  revalidatePath("/admin/lavanderia");
  if (sp!.orders?.customer_id) revalidatePath(`/admin/abbonati/${sp!.orders.customer_id}`);
  redirect(`${tornaA}?ok=${encodeURIComponent(`${sp!.item_name}: prezzi aggiornati.`)}`);
}

/** Incassa **subito** un capo speciale, invece di aspettare il rinnovo.
 *
 *  Il rischio che toglie
 *  ---------------------
 *  La strada normale è un invoice item agganciato all'abbonamento: entra nella
 *  prossima fattura e i soldi si muovono lì. Funziona finché il rinnovo arriva.
 *  Se il cliente disdice prima — è il caso di fabia, che chiude il 30/09 — la
 *  fattura successiva non esiste, e l'extra resta appeso al cliente senza
 *  nessuno che lo raccolga. Non è un caso di scuola: quel capo lo abbiamo già
 *  lavato e alla lavanderia lo paghiamo comunque.
 *
 *  Perché non era già così
 *  -----------------------
 *  Un prelievo fuori sessione può essere rifiutato con `authentication_required`
 *  sulle carte che chiedono la conferma del titolare (SCA). Era la ragione per
 *  cui si preferiva la fattura di rinnovo, dove Stripe usa il mandato firmato
 *  all'iscrizione.
 *
 *  Il rifiuto però non è una catastrofe, **se lo si gestisce**: la fattura resta
 *  aperta con il suo link di pagamento, e al cliente si manda quello. Peggio è
 *  la situazione di prima, in cui l'importo semplicemente non veniva mai
 *  chiesto a nessuno.
 *
 *  La fattura contiene **solo questo capo**: si crea prima la fattura e la voce
 *  ci si aggancia dentro. Creandola dopo, Stripe raccoglierebbe anche tutte le
 *  altre voci in sospeso del cliente e si incasserebbe roba non decisa qui. */
export async function addebitaSubitoCapo(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Solo admin");

  const specialId = String(formData.get("special_id") ?? "");
  const tornaA = String(formData.get("torna_a") ?? "/admin/extra");
  const esci = (chiave: "ok" | "warn", m: string) => redirect(`${tornaA}?${chiave}=${encodeURIComponent(m)}`);
  if (!specialId) esci("warn", "Capo mancante.");

  const svc = createServiceClient();
  const { data: sp } = await svc
    .from("order_specials")
    .select("id, order_id, item_name, qty, price_cli_cents, charged_at, refunded_at, annullato_at, stripe_invoice_item, orders(customer_id)")
    .eq("id", specialId)
    .maybeSingle<{ id: string; order_id: string; item_name: string; qty: number; price_cli_cents: number; charged_at: string | null; refunded_at: string | null; annullato_at: string | null; stripe_invoice_item: string | null; orders: { customer_id: string } | null }>();
  if (!sp) esci("warn", "Capo non trovato.");
  if (sp!.refunded_at || sp!.annullato_at) esci("warn", "Questo capo è chiuso: non c'è niente da incassare.");

  const userId = sp!.orders?.customer_id;
  if (!userId) esci("warn", "Questo ritiro non ha un cliente collegato.");

  const { data: sub } = await svc
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId!)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  const customerId = sub?.stripe_customer_id;
  if (!customerId) esci("warn", "Il cliente non ha un profilo di pagamento su Stripe: non c'è una carta da cui prelevare.");

  const importo = sp!.price_cli_cents * sp!.qty;
  const descrizione = `WashLoop · ${sp!.item_name}${sp!.qty > 1 ? ` ×${sp!.qty}` : ""} (ritiro ${sp!.order_id.slice(0, 8)})`;
  const sk = stripe();

  // Il capo può essere già «messo in fattura», cioè in coda per il rinnovo. È
  // lo stato peggiore di tutti: risulta addebitato — quindi non compare fra
  // quelli da incassare — ma i soldi non si sono mossi, e si muoveranno solo se
  // quel rinnovo arriva. Su un cliente che ha disdetto, mai.
  //
  // Da qui si può tirare fuori dalla coda e incassarlo adesso: si toglie la
  // voce in sospeso e si rifà dentro una fattura sua. Se invece è già finita su
  // una fattura, i soldi o si sono mossi o stanno per farlo, e non si tocca.
  if (sp!.charged_at && sp!.stripe_invoice_item) {
    const vecchia = await sk.invoiceItems.retrieve(sp!.stripe_invoice_item).catch(() => null);
    const suFattura = vecchia && (typeof vecchia.invoice === "string" ? vecchia.invoice : vecchia.invoice?.id ?? null);
    if (suFattura) {
      esci("warn", "Questo capo è già su una fattura emessa: o è stato incassato, o lo sarà con quella. Da qui non si tocca.");
    }
    if (vecchia) await sk.invoiceItems.del(sp!.stripe_invoice_item).catch(() => null);
  } else if (sp!.charged_at) {
    esci("warn", "Questo capo risulta addebitato ma non ha una voce su Stripe: controlla la scheda del ritiro prima di incassarlo.");
  }

  // 1. La fattura, vuota, che raccoglierà solo la voce qui sotto.
  const inv = await sk.invoices.create({
    customer: customerId!,
    collection_method: "charge_automatically",
    auto_advance: false,
    description: `Capo fuori abbonamento · ${sp!.item_name}`,
    metadata: { kind: "order_specials_subito", special_id: sp!.id, order_id: sp!.order_id },
  });

  // 2. La voce, dentro quella fattura e non in coda per la prossima.
  const ii = await sk.invoiceItems.create({
    customer: customerId!,
    invoice: inv.id,
    amount: importo,
    currency: "eur",
    description: descrizione,
    metadata: { order_id: sp!.order_id, special_id: sp!.id, kind: "order_specials" },
  });

  // Da qui in poi la voce esiste su Stripe: si segna subito, altrimenti un
  // errore nel prelievo la lascerebbe viva là fuori e invisibile qui — che è
  // esattamente il modo in cui un cliente si vede addebitare qualcosa che nel
  // pannello risulta «da addebitare».
  await svc
    .from("order_specials")
    .update({ charged_at: new Date().toISOString(), stripe_invoice_item: ii.id })
    .eq("id", sp!.id);

  const rivedi = () => {
    revalidatePath("/admin/extra");
    revalidatePath(`/admin/ordini/${sp!.order_id}`);
    revalidatePath(`/admin/abbonati/${userId}`);
    revalidatePath(`/app/ordini/${sp!.order_id}`);
  };

  try {
    await sk.invoices.finalizeInvoice(inv.id!);
    const pagata = await sk.invoices.pay(inv.id!);
    rivedi();
    if (pagata.status === "paid") {
      try {
        await notifySpecialAdded(userId!, { itemName: sp!.item_name, priceCents: importo, orderId: sp!.order_id });
      } catch (err) {
        console.error(`[charge] notifica capo ${specialId} non inviata:`, err);
      }
      // La ricevuta e la riga in `invoices` le scrive il webhook
      // `invoice.payment_succeeded`, come per ogni altro incasso.
      esci("ok", `Incassati ${(importo / 100).toFixed(2)} € per ${sp!.item_name}. La ricevuta parte da sola.`);
    }
    esci("warn", `Fattura emessa ma non ancora pagata (stato: ${pagata.status}). Il link di pagamento è nella scheda del cliente su Stripe.`);
  } catch (e) {
    // Prelievo rifiutato: quasi sempre è la carta che chiede la conferma del
    // titolare. La fattura resta aperta con il suo link, quindi l'importo non è
    // perso — va mandato al cliente.
    rivedi();
    const link = await sk.invoices.retrieve(inv.id!).then((i) => i.hosted_invoice_url).catch(() => null);
    const motivo = e instanceof Error ? e.message : "prelievo rifiutato";
    esci("warn", `Non sono riuscito a prelevare subito (${motivo}). La fattura resta aperta${link ? ` e il cliente la può pagare da qui: ${link}` : ""}.`);
  }
}

/** Storna un capo in un clic.
 *
 *  `refundOrderSpecial` fa già la cosa giusta e distingue i due casi — voce
 *  ancora in sospeso → si annulla, fattura già pagata → rimborso vero su Stripe
 *  — ma vuole un percorso di ritorno e non ne aveva uno: finiva sempre sulla
 *  scheda del ritiro, cioè lontano da dove si stava guardando.
 *
 *  Qui non si chiede un motivo. È una scelta, non una dimenticanza: sul
 *  registro degli incassi lo storno si fa mentre il cliente è al telefono, e un
 *  campo obbligatorio in mezzo trasforma un clic in una pratica. Il motivo
 *  resta obbligatorio dove serve davvero — sull'annullo di un capo mai
 *  addebitato, dove non c'è nessun movimento di denaro a raccontare il fatto. */
export async function stornaCapoSpeciale(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Solo admin");

  const specialId = String(formData.get("special_id") ?? "");
  const tornaA = String(formData.get("torna_a") ?? "/admin/extra");
  if (!specialId) redirect(`${tornaA}?warn=${encodeURIComponent("Capo mancante.")}`);

  const svc = createServiceClient();
  const { data: sp } = await svc
    .from("order_specials")
    .select("id, item_name, qty, price_cli_cents, charged_at, refunded_at, annullato_at")
    .eq("id", specialId)
    .maybeSingle<{ id: string; item_name: string; qty: number; price_cli_cents: number; charged_at: string | null; refunded_at: string | null; annullato_at: string | null }>();
  if (!sp) redirect(`${tornaA}?warn=${encodeURIComponent("Capo non trovato.")}`);
  if (sp!.refunded_at || sp!.annullato_at) redirect(`${tornaA}?warn=${encodeURIComponent("Questo capo è già stato chiuso.")}`);

  const dati = new FormData();
  dati.set("special_id", specialId);

  if (sp!.charged_at) {
    await refundOrderSpecial(dati);
  } else {
    // Mai chiesto niente al cliente: non è un rimborso, è un annullo. Il motivo
    // qui lo mette il sistema, perché il gesto è lo stesso e chi preme sta
    // dicendo la stessa cosa.
    dati.set("motivo", "Stornato dal registro dei capi extra");
    dati.set("torna_a", tornaA);
    await annullaCapoSpeciale(dati);
  }

  const importo = (sp!.price_cli_cents * sp!.qty / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  revalidatePath("/admin/extra");
  redirect(`${tornaA}?ok=${encodeURIComponent(`${sp!.item_name} stornato: ${importo} tolti al cliente e alla lavanderia.`)}`);
}
