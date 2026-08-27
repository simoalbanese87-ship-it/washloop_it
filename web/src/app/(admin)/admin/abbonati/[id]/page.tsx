import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createServiceClient } from "@/lib/supabase/server";
import { abbonamentoDaStripe, incassiCliente, capiSpecialiCliente, statoAbbonamentoItaliano } from "@/lib/cliente-360";
import { changeSubscription, addCustomerCharge, voidCustomerCharge, editCustomerCharge, resendCredentials, deleteCustomer, updateRecurringPickup, addRecurringPickup, setRecurringActive, addCustomerAddress, adminCreatePickup, sollecitaOra } from "@/lib/actions/admin-customer";
import { CustomSubscriptionForm } from "@/components/admin/CustomSubscriptionForm";
import { fmtDate, fmtDateTime, WEEKDAY_IT } from "@/lib/format";
import type { OrderStatus } from "@/lib/orders";
import { ATTESA_GIORNI } from "@/lib/dunning-piano";

const eur = (c: number) => "€" + (c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";


type Prof = { id: string; full_name: string | null; phone: string | null; client_code: string | null; role: string; created_at: string };
type Sub = { id: string; status: string; dunning_step: number | null; dunning_last_sent_at: string | null; last_failed_invoice_url: string | null; last_failed_at: string | null; plan_id: string | null; custom_price_cents: number | null; manual: boolean; current_period_end: string | null; activated_at: string | null; stripe_subscription_id: string | null; stripe_customer_id: string | null; plans: { name: string; price_month_cents: number } | null };
type Addr = { id: string; label: string | null; street: string };
type Ord = { id: string; status: OrderStatus; created_at: string; bags: number };
type Charge = { id: string; description: string; amount_cents: number; kind: string; status: string; created_at: string };
type Slot = { id: string; starts_at: string; ends_at: string; kind: string };

/** Gli stati degli addebiti erano mostrati grezzi ("pending", "invoiced"):
 *  parole tecniche in inglese in una schermata che si legge di fretta. */
const STATO_ADDEBITO: Record<string, string> = {
  pending: "da addebitare",
  invoiced: "sulla prossima fattura",
  settled: "incassato",
  void: "annullato",
};
type Rec = {
  id: string; weekday: number; hhmm: string; bags: number; active: boolean; needs_confirmation: boolean;
  delivery_hhmm: string | null; address_id: string; addresses: { label: string | null } | null;
  pending_weekday: number | null; pending_hhmm: string | null; pending_bags: number | null; pending_delivery_hhmm: string | null;
};

// Ordine di visualizzazione dei giorni: lun→dom.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; warn?: string }> }) {
  const { id } = await params;
  const { ok, warn } = await searchParams;
  const svc = createServiceClient();

  const { data: profile } = await svc.from("profiles").select("id, full_name, phone, client_code, role, created_at").eq("id", id).maybeSingle<Prof>();
  if (!profile) notFound();

  const [{ data: userRes }, { data: sub }, { data: addresses }, { data: orders }, { data: charges }, { data: recurring }, { data: slots }] = await Promise.all([
    svc.auth.admin.getUserById(id),
    svc.from("subscriptions").select("id, status, dunning_step, dunning_last_sent_at, last_failed_invoice_url, last_failed_at, plan_id, custom_price_cents, manual, current_period_end, activated_at, stripe_subscription_id, stripe_customer_id, plans(name, price_month_cents)").eq("user_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle<Sub>(),
    svc.from("addresses").select("id, label, street").eq("user_id", id).returns<Addr[]>(),
    svc.from("orders").select("id, status, created_at, bags").eq("customer_id", id).order("created_at", { ascending: false }).limit(20).returns<Ord[]>(),
    svc.from("customer_charges").select("id, description, amount_cents, kind, status, created_at").eq("customer_id", id).order("created_at", { ascending: false }).returns<Charge[]>(),
    svc.from("recurring_pickups").select("id, weekday, hhmm, bags, active, needs_confirmation, delivery_hhmm, address_id, addresses(label), pending_weekday, pending_hhmm, pending_bags, pending_delivery_hhmm").eq("customer_id", id).order("created_at", { ascending: false }).returns<Rec[]>(),
    svc.from("slots").select("id, starts_at, ends_at, kind").gte("starts_at", new Date().toISOString()).order("starts_at").limit(60).returns<Slot[]>(),
  ]);
  const email = userRes?.user?.email ?? "—";

  // Verità da Stripe + tutto quello che la scheda non mostrava: incassi
  // registrati (ricevute e fatture) e capi fuori abbonamento.
  const [stripeSub, incassi, capi] = await Promise.all([
    sub?.stripe_subscription_id ? abbonamentoDaStripe(sub.stripe_subscription_id, sub.stripe_customer_id ?? null) : Promise.resolve(null),
    incassiCliente(id),
    capiSpecialiCliente(id),
  ]);

  const totaleIncassatoCents = incassi.reduce((t, i) => t + i.amount_cents, 0);
  const addebitatoCents = charges?.filter((c) => c.kind !== "refund" && c.status !== "void").reduce((t, c) => t + c.amount_cents, 0) ?? 0;
  const stornatoCents = charges?.filter((c) => c.kind === "refund" && c.status !== "void").reduce((t, c) => t + c.amount_cents, 0) ?? 0;

  // Le fasce future, divise per tipo: servono al ritiro creato dall'amministrazione.
  const slotRitiro = (slots ?? []).filter((sl) => sl.kind === "pickup");
  const slotConsegna = (slots ?? []).filter((sl) => sl.kind === "delivery");

  const active = sub?.status === "active" || sub?.status === "trialing";
  const inSofferenza = sub?.status === "past_due" || sub?.status === "unpaid";
  const solleciti = sub?.dunning_step ?? 0;
  const priceLabel =
    sub?.custom_price_cents === 0
      ? "€0,00 (omaggio)"
      : sub?.custom_price_cents != null
        ? `${eur(sub.custom_price_cents)} (custom)`
        : sub?.plans
          ? `${eur(sub.plans.price_month_cents)}`
          : "—";

  return (
    <>
      <Link href="/admin/abbonati" className="font-display text-sm font-bold text-blue hover:underline">← Abbonati</Link>
      <PageTitle kicker="Cliente" title={profile.full_name ?? "Cliente"} sub={`${email}${profile.client_code ? ` · ${profile.client_code}` : ""} · Iscritto il ${fmtDate(profile.created_at)}`} />

      {ok && (
        <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>
      )}
      {warn && (
        <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>
      )}

      <form action={resendCredentials} className="mb-4">
        <input type="hidden" name="customer_id" value={id} />
        <Button type="submit" size="md" variant="ghost-navy">Reinvia credenziali via email</Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Abbonamento */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Abbonamento</h2>
          {sub ? (
            <>
              <div className="mt-3 space-y-1 text-sm font-medium text-muted">
                <div>Piano: <span className="font-bold text-navy">{sub.plans?.name ?? "—"}</span> · {priceLabel}/mese {sub.manual && <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-bold text-navy">manuale</span>}</div>
                <div>Stato: <span className={`font-bold ${active ? "text-[#1F8A5B]" : "text-[#C9881F]"}`}>{statoAbbonamentoItaliano(sub.status)}</span></div>
                {sub.activated_at && <div>Attivato il: <span className="font-bold text-navy">{fmtDate(sub.activated_at)}</span></div>}
                {sub.current_period_end && <div>Rinnovo: {fmtDate(sub.current_period_end)}</div>}
              </div>

              {/* A che punto è il recupero: senza, l'operatore non sa se il
                  cliente è già stato sollecitato e quante volte, e finisce per
                  telefonargli sopra un'email appena partita.
                  Compare a partire dal pagamento in sospeso e non dal primo
                  sollecito: chi era bloccato da prima che il recupero
                  esistesse è a zero solleciti, ed è proprio quello che va
                  fatto partire a mano. */}
              {inSofferenza && (
                <div className="mt-3 rounded-[14px] border border-[#C0392B]/30 bg-[#C0392B]/6 p-3">
                  <div className="font-display text-xs font-extrabold uppercase tracking-wide text-[#C0392B]">Recupero pagamento</div>
                  <div className="mt-1 space-y-1 text-sm font-medium text-muted">
                    <div>
                      Solleciti inviati: <span className="font-bold text-navy">{solleciti} di 3</span>
                      {sub.dunning_last_sent_at && <> · ultimo {fmtDate(sub.dunning_last_sent_at)}</>}
                    </div>
                    {sub.last_failed_at && <div>Primo fallimento: {fmtDate(sub.last_failed_at)}</div>}
                    {sub.last_failed_invoice_url ? (
                      <a href={sub.last_failed_invoice_url} target="_blank" rel="noreferrer" className="inline-block font-display text-xs font-bold text-blue hover:underline">
                        Apri la fattura da saldare →
                      </a>
                    ) : (
                      <div className="text-xs">Nessun link salvato: lo cerchiamo su Stripe al primo sollecito.</div>
                    )}

                    {solleciti === 0 ? (
                      <p className="rounded-[10px] bg-[#C9881F]/12 px-2.5 py-1.5 text-xs font-semibold text-[#C9881F]">
                        Nessun sollecito ancora partito. Quelli automatici li fa scattare Stripe quando un addebito
                        fallisce: se il blocco è vecchio, quel momento può non arrivare mai. Falli partire tu — dal
                        secondo in poi prosegue il calendario da solo.
                      </p>
                    ) : solleciti >= 3 ? (
                      <p className="rounded-[10px] bg-[#C0392B]/10 px-2.5 py-1.5 text-xs font-semibold text-[#C0392B]">
                        Solleciti automatici esauriti. Da qui in poi decide una persona: telefonata o chiusura.
                      </p>
                    ) : (
                      <p className="text-xs">Il prossimo parte da solo {(ATTESA_GIORNI[solleciti] ?? 3)} giorni dopo l&apos;ultimo. Con il bottone lo anticipi.</p>
                    )}

                    <form
                      action={sollecitaOra}
                      className="pt-1"
                    >
                      <input type="hidden" name="customer_id" value={id} />
                      <input type="hidden" name="sub_id" value={sub.id} />
                      <Button type="submit" size="md">
                        {solleciti === 0 ? "Manda il 1º sollecito adesso" : solleciti >= 3 ? "Rimanda l'ultimo avviso" : `Manda il ${solleciti + 1}º sollecito adesso`}
                      </Button>
                    </form>
                    <p className="text-[11px]">Parte davvero un&apos;email al cliente, con notifica push.</p>
                  </div>
                </div>
              )}

              {/* Cosa dice Stripe, che è la fonte del vero sui soldi: la nostra
                  copia arriva dai webhook e può essere rimasta indietro. */}
              {stripeSub && (
                <div className="mt-3 rounded-[14px] border border-line bg-ice/60 p-3">
                  <div className="font-display text-xs font-extrabold uppercase tracking-wide text-navy/60">Secondo Stripe</div>
                  {stripeSub.errore ? (
                    <p className="mt-1 text-xs font-semibold text-[#C9881F]">Non verificabile: {stripeSub.errore}</p>
                  ) : (
                    <div className="mt-1 space-y-1 text-sm font-medium text-muted">
                      <div>
                        Stato: <span className="font-bold text-navy">{stripeSub.statoItaliano}</span>
                        {stripeSub.disdettaAFinePeriodo && <span className="ml-2 rounded-full bg-[#C9881F]/12 px-2 py-0.5 text-[11px] font-bold text-[#C9881F]">disdetta a fine periodo</span>}
                      </div>
                      <div>
                        Pagamenti riusciti: <span className="font-bold text-navy">{stripeSub.pagamentiRiusciti}</span>
                        {stripeSub.pagamentiRiusciti > 0 && <> · totale {eur(stripeSub.totalePagatoCents)} · ultimo {fmtDate(stripeSub.ultimoPagamento!)}</>}
                      </div>
                      {stripeSub.prossimoAddebito ? (
                        <div>Prossimo addebito: <span className="font-bold text-navy">{fmtDate(stripeSub.prossimoAddebito.data)}</span> · {eur(stripeSub.prossimoAddebito.importoCents)}</div>
                      ) : (
                        <div>Nessun addebito futuro programmato.</div>
                      )}
                      {stripeSub.pagamentiRiusciti === 0 && (
                        <p className="rounded-[10px] bg-[#C0392B]/8 px-2.5 py-1.5 text-xs font-semibold text-[#C0392B]">
                          Attenzione: risulta abbonato ma non ha mai pagato nulla.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {!active && (
                <p className="mt-2 rounded-[10px] bg-[#C9881F]/10 px-3 py-2 text-xs font-semibold text-[#C9881F]">
                  Abbonamento non ancora attivo. Conferma il pagamento per attivarlo.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {active ? (
                  <form action={changeSubscription}><input type="hidden" name="sub_id" value={sub.id} /><input type="hidden" name="action" value="pause" /><Button type="submit" size="md" variant="ghost-navy">Metti in pausa</Button></form>
                ) : (
                  <form action={changeSubscription}><input type="hidden" name="sub_id" value={sub.id} /><input type="hidden" name="action" value="activate" /><Button type="submit" size="md">Segna come pagato / Attiva</Button></form>
                )}
                <form action={changeSubscription}><input type="hidden" name="sub_id" value={sub.id} /><input type="hidden" name="action" value="cancel" /><button type="submit" className="rounded-full border border-[#C0392B]/40 px-4 py-2 font-display text-sm font-bold text-[#C0392B]">Disdici</button></form>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm font-medium text-muted">Nessun abbonamento.</p>
          )}
          {!active && <CustomSubscriptionForm customerId={id} />}
        </Card>

        {/* Indirizzi */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Indirizzi</h2>
          <div className="mt-3 space-y-2">
            {(addresses ?? []).length === 0 ? (
              <p className="text-sm font-medium text-muted">
                Nessun indirizzo. Un cliente creato da qui nasce senza: finché non ne ha uno non si può prenotargli niente,
                e in app trova solo un avviso al posto della prenotazione.
              </p>
            ) : (
              (addresses ?? []).map((a) => (
                <div key={a.id} className="rounded-[12px] border border-line bg-ice px-3 py-2 text-sm">
                  <span className="font-bold text-navy">{a.label ?? "Indirizzo"}</span> <span className="text-muted">· {a.street}</span>
                </div>
              ))
            )}
          </div>

          <details className="mt-4" open={(addresses ?? []).length === 0}>
            <summary className="cursor-pointer font-display text-sm font-bold text-blue">+ Aggiungi indirizzo</summary>
            <form action={addCustomerAddress} className="mt-3 grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="customer_id" value={id} />
              <label className="text-xs font-bold text-muted sm:col-span-2">Via<input name="street" required placeholder="es. Via Franco Russoli" className={input} /></label>
              <label className="text-xs font-bold text-muted">Civico<input name="civico" required placeholder="9" className={input} /></label>
              <label className="text-xs font-bold text-muted">CAP<input name="cap" inputMode="numeric" pattern="\d{5}" placeholder="20143" className={input} /></label>
              <label className="text-xs font-bold text-muted">Città<input name="city" defaultValue="Milano" className={input} /></label>
              <label className="text-xs font-bold text-muted">Etichetta<input name="label" defaultValue="Casa" className={input} /></label>
              <label className="text-xs font-bold text-muted">Come si entra
                <select name="access_mode" defaultValue="door" className={input}>
                  <option value="door">Alla porta</option>
                  <option value="home">Al portone</option>
                  <option value="concierge">Portineria</option>
                </select>
              </label>
              <label className="text-xs font-bold text-muted">Citofono<input name="intercom" placeholder="Cognome sul citofono" className={input} /></label>
              <label className="text-xs font-bold text-muted">Piano<input name="floor" placeholder="es. 3" className={input} /></label>
              <label className="text-xs font-bold text-muted">Orario portineria<input name="concierge_hours" placeholder="es. 8:00–18:00" className={input} /></label>
              <label className="text-xs font-bold text-muted sm:col-span-2">Nota per il rider<input name="access_note" placeholder="Nome del portinaio, indicazioni…" className={input} /></label>
              <div className="sm:col-span-2"><Button type="submit" size="md">Salva indirizzo</Button></div>
            </form>
            <p className="mt-2 text-xs font-medium text-muted">La zona si ricava dal CAP. Se il CAP non è coperto da una zona attiva l&apos;indirizzo si salva lo stesso, ma va assegnato a mano.</p>
          </details>
        </Card>
      </div>

      {/* Ritiro creato dall'amministrazione, per chi prenota al telefono */}
      <Card className="mt-6">
        <h2 className="font-display text-base font-extrabold text-navy">Crea un ritiro per il cliente</h2>
        <p className="mt-1 text-xs font-medium text-muted">
          Per chi prenota al telefono. Salta il controllo sull&apos;abbonamento — quello vale per il cliente in app, non per te —
          quindi funziona anche con un pagamento fallito in corso. L&apos;ordine resta marcato come creato dall&apos;amministrazione,
          e il cliente riceve l&apos;email di conferma come per una prenotazione qualsiasi.
        </p>
        {(addresses ?? []).length === 0 ? (
          <p className="mt-3 text-sm font-medium text-muted">Aggiungi prima un indirizzo.</p>
        ) : slotRitiro.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-muted">
            Nessuna fascia di ritiro futura. <Link href="/admin/catalogo" className="font-bold text-blue hover:underline">Generane in Catalogo →</Link>
          </p>
        ) : (
          <form action={adminCreatePickup} className="mt-4 grid gap-2 sm:grid-cols-[1.2fr_1.4fr_1.4fr_0.6fr_auto] sm:items-end">
            <input type="hidden" name="customer_id" value={id} />
            <label className="text-xs font-bold text-muted">Indirizzo
              <select name="address_id" required className={input} defaultValue={(addresses ?? [])[0]?.id}>
                {(addresses ?? []).map((a) => (<option key={a.id} value={a.id}>{a.label ?? a.street}</option>))}
              </select>
            </label>
            <label className="text-xs font-bold text-muted">Ritiro
              <select name="pickup_slot_id" required className={input} defaultValue="">
                <option value="" disabled>Scegli…</option>
                {slotRitiro.map((sl) => (<option key={sl.id} value={sl.id}>{fmtDateTime(sl.starts_at)}</option>))}
              </select>
            </label>
            <label className="text-xs font-bold text-muted">Riconsegna
              <select name="delivery_slot_id" className={input} defaultValue="">
                <option value="">Da fissare dopo</option>
                {slotConsegna.map((sl) => (<option key={sl.id} value={sl.id}>{fmtDateTime(sl.starts_at)}</option>))}
              </select>
            </label>
            <label className="text-xs font-bold text-muted">Sacchi<input name="bags" type="number" min="1" defaultValue={1} className={input} /></label>
            <Button type="submit" size="md">Crea ritiro</Button>
            <label className="text-xs font-bold text-muted sm:col-span-5">Note per il rider<input name="notes" placeholder="es. citofonare due volte" className={input} /></label>
          </form>
        )}
      </Card>

      {/* Ritiri ricorrenti — orari indicati dal cliente, modificabili dall'admin */}
      <Card className="mt-6">
        <h2 className="font-display text-base font-extrabold text-navy">Ritiri ricorrenti</h2>
        <p className="mt-1 text-xs font-medium text-muted">Gli orari di ritiro settimanale del cliente e l&apos;orario di consegna preferito. Se li modifichi, la modifica resta <strong>in sospeso</strong> finché il cliente non la conferma in app (fino ad allora vale l&apos;orario attuale). Il cliente riceve email + notifica.</p>

        <div className="mt-4 space-y-3">
          {(recurring ?? []).length === 0 ? (
            <p className="text-sm font-medium text-muted">Nessun ritiro ricorrente impostato.</p>
          ) : (
            (recurring ?? []).map((r) => (
              <div key={r.id} className={`rounded-[14px] border p-3 ${r.active ? "border-line" : "border-line bg-ice opacity-70"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-extrabold text-navy">Ogni {WEEKDAY_IT[r.weekday]} · {r.hhmm}</span>
                  {r.delivery_hhmm && <span className="text-xs font-medium text-muted">· consegna pref. {r.delivery_hhmm}</span>}
                  <span className="text-xs font-medium text-muted">· {r.addresses?.label ?? "indirizzo"}</span>
                  {!r.active && <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-bold text-navy">non attivo</span>}
                  {r.needs_confirmation && <span className="rounded-full bg-[#C9881F]/15 px-2 py-0.5 text-[11px] font-bold text-[#C9881F]">in attesa di conferma cliente</span>}
                </div>
                {r.pending_hhmm != null && (
                  <p className="mb-2 rounded-[10px] bg-[#C9881F]/10 px-3 py-2 text-xs font-semibold text-[#C9881F]">
                    Proposta in sospeso: Ogni {WEEKDAY_IT[r.pending_weekday ?? r.weekday]} · {r.pending_hhmm} · {r.pending_bags} {r.pending_bags === 1 ? "sacco" : "sacchi"}{r.pending_delivery_hhmm ? ` · consegna ${r.pending_delivery_hhmm}` : ""} — in attesa che il cliente confermi.
                  </p>
                )}
                <form action={updateRecurringPickup} className="grid gap-2 sm:grid-cols-[1fr_0.8fr_0.8fr_0.6fr_auto] sm:items-end">
                  <input type="hidden" name="rec_id" value={r.id} />
                  <input type="hidden" name="customer_id" value={id} />
                  <label className="text-xs font-bold text-muted">Giorno
                    <select name="weekday" defaultValue={r.pending_weekday ?? r.weekday} className={input}>
                      {WEEKDAY_ORDER.map((w) => (<option key={w} value={w}>{WEEKDAY_IT[w]}</option>))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-muted">Ritiro<input name="hhmm" type="time" required defaultValue={r.pending_hhmm ?? r.hhmm} className={input} /></label>
                  <label className="text-xs font-bold text-muted">Consegna<input name="delivery_hhmm" type="time" defaultValue={r.pending_delivery_hhmm ?? r.delivery_hhmm ?? ""} className={input} /></label>
                  <label className="text-xs font-bold text-muted">Sacchi<input name="bags" type="number" min="1" required defaultValue={r.pending_bags ?? r.bags} className={input} /></label>
                  <Button type="submit" size="md">Proponi modifica</Button>
                </form>
                <form action={setRecurringActive} className="mt-2">
                  <input type="hidden" name="rec_id" value={r.id} />
                  <input type="hidden" name="customer_id" value={id} />
                  <input type="hidden" name="active" value={r.active ? "false" : "true"} />
                  <button type="submit" className="font-display text-xs font-bold text-blue hover:underline">{r.active ? "Disattiva" : "Riattiva"}</button>
                </form>
              </div>
            ))
          )}
        </div>

        {/* Aggiungi ricorrenza */}
        {(addresses ?? []).length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer font-display text-sm font-bold text-blue">+ Aggiungi ritiro ricorrente</summary>
            <form action={addRecurringPickup} className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.6fr_auto] sm:items-end">
              <input type="hidden" name="customer_id" value={id} />
              <label className="text-xs font-bold text-muted">Indirizzo
                <select name="address_id" required className={input} defaultValue="">
                  <option value="" disabled>Scegli…</option>
                  {(addresses ?? []).map((a) => (<option key={a.id} value={a.id}>{a.label ?? a.street}</option>))}
                </select>
              </label>
              <label className="text-xs font-bold text-muted">Giorno
                <select name="weekday" className={input} defaultValue={1}>
                  {WEEKDAY_ORDER.map((w) => (<option key={w} value={w}>{WEEKDAY_IT[w]}</option>))}
                </select>
              </label>
              <label className="text-xs font-bold text-muted">Ritiro<input name="hhmm" type="time" required defaultValue="09:00" className={input} /></label>
              <label className="text-xs font-bold text-muted">Consegna<input name="delivery_hhmm" type="time" className={input} /></label>
              <label className="text-xs font-bold text-muted">Sacchi<input name="bags" type="number" min="1" required defaultValue={1} className={input} /></label>
              <Button type="submit" size="md">Proponi</Button>
            </form>
          </details>
        ) : (
          <p className="mt-3 text-xs font-medium text-muted">Aggiungi prima un indirizzo per creare un ritiro ricorrente.</p>
        )}
      </Card>

      {/* Storico pagamenti, riga per riga, direttamente da Stripe.
          Il registro locale `invoices` parte da agosto 2026 e i pagamenti
          precedenti non ci sono: questo elenco copre tutta la vita del cliente,
          e soprattutto mostra QUALE fattura è rimasta aperta — che è la domanda
          che ci si fa quando arriva la telefonata. */}
      {stripeSub && !stripeSub.errore && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-extrabold text-navy">Storico pagamenti ({stripeSub.fatture.length})</h2>
            <span className="text-sm font-medium text-muted">
              {stripeSub.pagamentiRiusciti} riusciti · <strong className="text-navy">{eur(stripeSub.totalePagatoCents)}</strong> incassati
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-muted">Ogni fattura emessa da Stripe su questo cliente, dalla più recente. «Apri» porta alla pagina di pagamento: si può mandare al cliente così com&apos;è.</p>

          <div className="mt-4 space-y-2">
            {stripeSub.fatture.length === 0 ? (
              <p className="text-sm font-medium text-muted">Nessuna fattura su Stripe per questo cliente.</p>
            ) : (
              stripeSub.fatture.map((f) => (
                <div
                  key={f.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-[12px] border px-3 py-2 text-sm ${
                    f.pagata ? "border-line bg-ice" : "border-[#C0392B]/30 bg-[#C0392B]/6"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-bold text-navy">{f.numero ? `Fattura ${f.numero}` : "Fattura"}</span>
                    <span className="text-muted"> · {fmtDate(f.data)}</span>
                    {!f.pagata && f.tentativi > 0 && (
                      <span className="text-muted"> · {f.tentativi} {f.tentativi === 1 ? "tentativo" : "tentativi"}</span>
                    )}
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <span className={`font-display font-extrabold ${f.pagata ? "text-navy" : "text-[#C0392B]"}`}>
                      {f.pagata ? eur(f.importoCents) : `${eur(f.dovutoCents)} da saldare`}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${f.pagata ? "bg-[#1F8A5B]/12 text-[#1F8A5B]" : "bg-[#C0392B]/12 text-[#C0392B]"}`}>
                      {f.stato}
                    </span>
                    {f.url && (
                      <a href={f.url} target="_blank" rel="noreferrer" className="font-display text-xs font-bold text-blue hover:underline">
                        Apri →
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Addebiti / rimborsi personalizzati */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-extrabold text-navy">Addebiti e storni</h2>
          {(addebitatoCents > 0 || stornatoCents > 0) && (
            <span className="text-sm font-medium text-muted">
              {eur(addebitatoCents)} addebitati · {eur(stornatoCents)} stornati ·{" "}
              <strong className="text-navy">{eur(addebitatoCents - stornatoCents)} netti</strong>
            </span>
          )}
        </div>
        <p className="mt-1 text-xs font-medium text-muted">Extra fuori ordine, modifiche, crediti. Gli addebiti su cliente con carta Stripe finiscono sulla prossima ricevuta. I rimborsi vanno confermati anche da Stripe.</p>

        <form action={addCustomerCharge} className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="customer_id" value={id} />
          <label className="text-xs font-bold text-muted">Descrizione<input name="description" required placeholder="es. Lavaggio tappeto fuori listino" className={input} /></label>
          <label className="text-xs font-bold text-muted">Importo €<input name="amount_eur" required type="number" step="0.01" min="0" className={input} /></label>
          <label className="text-xs font-bold text-muted">Tipo
            <select name="kind" className={input} defaultValue="charge">
              <option value="charge">Addebito</option>
              <option value="refund">Rimborso</option>
            </select>
          </label>
          <Button type="submit" size="md">Aggiungi</Button>
        </form>

        <div className="mt-4 space-y-2">
          {(charges ?? []).length === 0 ? (
            <p className="text-sm font-medium text-muted">Nessun addebito personalizzato.</p>
          ) : (
            (charges ?? []).map((c) => (
              <div key={c.id} className="rounded-[12px] border border-line px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`font-bold text-navy ${c.status === "void" ? "line-through" : ""}`}>{c.description}</span>
                    <span className="ml-2 text-xs font-medium text-muted">{fmtDate(c.created_at)} · {STATO_ADDEBITO[c.status] ?? c.status}</span>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <span className={`font-display font-extrabold ${c.kind === "refund" ? "text-[#1F8A5B]" : "text-navy"}`}>{c.kind === "refund" ? "−" : ""}{eur(c.amount_cents)}</span>
                    {c.status !== "void" && (
                      <form action={voidCustomerCharge}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="customer_id" value={id} />
                        <button type="submit" className="font-display text-xs font-bold text-[#C0392B] hover:underline">Annulla</button>
                      </form>
                    )}
                  </div>
                </div>
                {c.status !== "void" && (
                  <details className="mt-1">
                    <summary className="cursor-pointer font-display text-xs font-bold text-blue">Modifica</summary>
                    <form action={editCustomerCharge} className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="customer_id" value={id} />
                      <input name="description" defaultValue={c.description} className={input} />
                      <input name="amount_eur" type="number" step="0.01" min="0" defaultValue={(c.amount_cents / 100).toFixed(2)} className={input} />
                      <Button type="submit" size="md" variant="ghost-navy">Salva</Button>
                    </form>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Incassi e ricevute. La tabella esisteva già e la scheda non la
          leggeva: per sapere se un cliente aveva pagato bisognava aprire
          Stripe. Si scrive "ricevuta": la fattura è l'eccezione, e si nomina
          solo dove esiste davvero. */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-extrabold text-navy">Incassi e ricevute ({incassi.length})</h2>
          <span className="font-display text-sm font-extrabold text-navy">{eur(totaleIncassatoCents)} incassati in tutto</span>
        </div>
        <div className="mt-3 divide-y divide-line">
          {incassi.length === 0 ? (
            <p className="py-2 text-sm font-medium text-muted">
              Nessun incasso registrato. Il registro parte da agosto 2026: i pagamenti precedenti si vedono nel riquadro «Secondo Stripe» qui sopra.
            </p>
          ) : (
            incassi.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <div className="font-bold text-navy">{i.fic_number ? `Fattura n. ${i.fic_number}` : "Ricevuta"}</div>
                  <div className="text-xs font-medium text-muted">{fmtDate(i.created_at)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display font-extrabold text-navy">{eur(i.amount_cents)}</span>
                  {i.fic_url && (
                    <a href={i.fic_url} target="_blank" rel="noreferrer" className="font-display text-[11px] font-bold text-blue hover:underline">Apri</a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Capi fuori abbonamento: prima si vedevano solo entrando nel singolo ordine */}
      {capi.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-display text-base font-extrabold text-navy">Capi fuori abbonamento ({capi.length})</h2>
          <div className="mt-3 divide-y divide-line">
            {capi.map((c) => (
              <Link key={c.id} href={`/admin/ordini/${c.order_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm transition-colors hover:bg-ice">
                <div>
                  <div className="font-bold text-navy">{c.qty}× {c.item_name}</div>
                  <div className="text-xs font-medium text-muted">
                    {fmtDate(c.created_at)} · {c.refunded_at ? "stornato" : c.charged_at ? "addebitato" : "non ancora addebitato"}
                  </div>
                </div>
                <span className={`font-display font-extrabold ${c.refunded_at ? "text-muted line-through" : "text-navy"}`}>
                  {eur(c.price_cli_cents * c.qty)}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Ordini */}
      <Card className="mt-6">
        <h2 className="font-display text-base font-extrabold text-navy">Ordini ({orders?.length ?? 0})</h2>
        <div className="mt-3 space-y-2">
          {(orders ?? []).length === 0 ? (
            <p className="text-sm font-medium text-muted">Nessun ordine.</p>
          ) : (
            (orders ?? []).map((o) => (
              <Link key={o.id} href={`/admin/ordini/${o.id}`} className="flex items-center justify-between gap-3 rounded-[12px] border border-line px-3 py-2 text-sm transition-colors hover:bg-ice">
                <span className="font-bold text-navy">#{o.id.slice(0, 8)}</span>
                <span className="text-muted">{o.bags} {o.bags === 1 ? "sacco" : "sacchi"} · {fmtDate(o.created_at)}</span>
                <span className="font-display text-xs font-bold text-blue">{o.status}</span>
              </Link>
            ))
          )}
        </div>
      </Card>

      {/* Elimina lead / cliente */}
      <Card className="mt-6 border-[#C0392B]/30">
        <h2 className="font-display text-base font-extrabold text-[#C0392B]">Elimina lead</h2>
        <p className="mt-1 text-xs font-medium text-muted">
          Rimuove definitivamente il cliente e tutti i suoi dati (profilo, indirizzi, abbonamento, addebiti e ordini chiusi). Operazione irreversibile.
          Non è possibile se ha un abbonamento attivo (disdicilo prima) o ordini in corso.
        </p>
        <details className="mt-3">
          <summary className="inline-flex cursor-pointer rounded-full border border-[#C0392B]/40 px-4 py-2 font-display text-sm font-bold text-[#C0392B] transition-colors hover:bg-[#C0392B]/5">
            Elimina definitivamente…
          </summary>
          <form action={deleteCustomer} className="mt-3 flex items-center gap-3">
            <input type="hidden" name="customer_id" value={id} />
            <span className="text-sm font-semibold text-navy">Sei sicuro? L&apos;azione non è annullabile.</span>
            <button type="submit" className="rounded-full bg-[#C0392B] px-5 py-2 font-display text-sm font-extrabold text-white transition-opacity hover:opacity-90">
              Sì, elimina
            </button>
          </form>
        </details>
      </Card>
    </>
  );
}
