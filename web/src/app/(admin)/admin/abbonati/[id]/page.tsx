import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { createServiceClient } from "@/lib/supabase/server";
import { abbonamentoDaStripe, incassiCliente, capiSpecialiCliente, statoAbbonamentoItaliano } from "@/lib/cliente-360";
import { changeSubscription, addCustomerCharge, voidCustomerCharge, editCustomerCharge, resendCredentials, deleteCustomer, updateRecurringPickup, addRecurringPickup, setRecurringActive, addCustomerAddress, adminCreatePickup, sollecitaOra } from "@/lib/actions/admin-customer";
import { CustomSubscriptionForm } from "@/components/admin/CustomSubscriptionForm";
import { BottoneInvio } from "@/components/ui/BottoneInvio";
import { impersonate } from "@/lib/actions/impersonate";
import { cancelOrder } from "@/lib/actions/orders";
import { fmtDate, fmtDateTime, WEEKDAY_IT } from "@/lib/format";
import { ORDER_STATUS_LABEL, ordineAperto, type OrderStatus } from "@/lib/orders";
import { ATTESA_GIORNI } from "@/lib/dunning-piano";

const eur = (c: number) => "€" + (c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";


type Prof = { id: string; full_name: string | null; phone: string | null; client_code: string | null; role: string; created_at: string;
  billing_wants_invoice: boolean | null; billing_name: string | null; billing_address: string | null; billing_cap: string | null;
  billing_city: string | null; billing_tax_code: string | null; billing_vat: string | null; billing_sdi: string | null; billing_pec: string | null };
type Sub = { id: string; status: string; dunning_step: number | null; dunning_last_sent_at: string | null; last_failed_invoice_url: string | null; last_failed_at: string | null; plan_id: string | null; custom_price_cents: number | null; manual: boolean; current_period_end: string | null; activated_at: string | null; stripe_subscription_id: string | null; stripe_customer_id: string | null; plans: { name: string; price_month_cents: number } | null };
type Addr = { id: string; label: string | null; street: string };
type Ord = { id: string; status: OrderStatus; created_at: string; bags: number; pickup_slot: { starts_at: string } | null };
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

  const { data: profile } = await svc.from("profiles").select("id, full_name, phone, client_code, role, created_at, billing_wants_invoice, billing_name, billing_address, billing_cap, billing_city, billing_tax_code, billing_vat, billing_sdi, billing_pec").eq("id", id).maybeSingle<Prof>();
  if (!profile) notFound();

  const [{ data: userRes }, { data: sub }, { data: addresses }, { data: orders }, { data: charges }, { data: recurring }, { data: slots }] = await Promise.all([
    svc.auth.admin.getUserById(id),
    svc.from("subscriptions").select("id, status, dunning_step, dunning_last_sent_at, last_failed_invoice_url, last_failed_at, plan_id, custom_price_cents, manual, current_period_end, activated_at, stripe_subscription_id, stripe_customer_id, plans(name, price_month_cents)").eq("user_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle<Sub>(),
    svc.from("addresses").select("id, label, street").eq("user_id", id).returns<Addr[]>(),
    svc.from("orders").select("id, status, created_at, bags, pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at)").eq("customer_id", id).order("created_at", { ascending: false }).limit(20).returns<Ord[]>(),
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
  const disdetto = sub?.status === "canceled";

  // Cosa impedisce di eliminare il cliente. Va saputo PRIMA di premere il
  // bottone rosso: si arrivava in fondo alla conferma «sei sicuro» per poi
  // sbattere contro un avviso, senza sapere cosa sistemare.
  const ordiniAperti = (orders ?? []).filter((o) => ordineAperto(o.status));
  const bloccoElimina: string | null =
    sub && ["active", "trialing", "past_due"].includes(sub.status)
      ? "Ha un abbonamento ancora attivo: disdicilo qui sopra, così si ferma anche l'addebito su Stripe."
      : ordiniAperti.length > 0
        ? ordiniAperti.length === 1
          ? "C'è un ordine ancora aperto. Annullalo qui sotto e poi si può eliminare."
          : `Ci sono ${ordiniAperti.length} ordini ancora aperti. Annullali qui sotto e poi si può eliminare.`
        : null;
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
      <PageTitle kicker="Cliente" title={profile.full_name ?? "Cliente"} sub={`${email}${profile.client_code ? ` · ${profile.client_code}` : ""} · ${profile.phone ?? "SENZA TELEFONO"} · Iscritto il ${fmtDate(profile.created_at)}`} />

      {ok && (
        <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>
      )}
      {warn && (
        <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form action={resendCredentials}>
          <input type="hidden" name="customer_id" value={id} />
          <Button type="submit" size="md" variant="ghost-navy">Reinvia credenziali via email</Button>
        </form>
        {/* «Accedi come» stava solo nell'elenco abbonati: chi apriva la scheda
            di un cliente per capire un problema doveva tornare indietro e
            ritrovarlo in lista. Serve qui, dov'è il problema. */}
        <form action={impersonate}>
          <input type="hidden" name="user_id" value={id} />
          <BottoneInvio
            attesa="Entro…"
            className="inline-flex min-h-[48px] items-center rounded-full border-2 border-navy/30 px-6 font-display text-[15px] font-extrabold text-navy transition-colors hover:bg-navy/5"
          >
            Accedi come cliente →
          </BottoneInvio>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
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
                {/* Niente "Disdici" su un abbonamento già disdetto: premerlo
                    rispondeva "Abbonamento disdetto" e sembrava che la
                    disdetta di prima non fosse mai avvenuta. */}
                {!disdetto && (
                  <form action={changeSubscription}><input type="hidden" name="sub_id" value={sub.id} /><input type="hidden" name="action" value="cancel" /><button type="submit" className="rounded-full border border-[#C0392B]/40 px-4 py-2 font-display text-sm font-bold text-[#C0392B]">Disdici</button></form>
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm font-medium text-muted">Nessun abbonamento.</p>
          )}
          {!active && <CustomSubscriptionForm customerId={id} />}
        </Card>

        {/* Fatturazione: chi la vuole va saputo QUI, sulla scheda di chi paga.
            Prima non era scritto da nessuna parte, e in Incassi ogni incasso
            compariva fra le «fatture da fare» anche di chi non ne aveva chiesta
            nessuna — quindi il dato vero non si distingueva dal rumore. */}
        {profile.billing_wants_invoice ? (
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-extrabold text-navy">Fatturazione</h2>
              <span className="rounded-full bg-[#C9881F]/15 px-2.5 py-0.5 font-display text-[11px] font-extrabold uppercase text-[#C9881F]">
                Vuole la fattura
              </span>
            </div>
            <div className="mt-3 space-y-1 text-sm font-medium text-muted">
              <div>Intestazione: <span className="font-bold text-navy">{profile.billing_name ?? "—"}</span></div>
              <div>{[profile.billing_address, profile.billing_cap, profile.billing_city].filter(Boolean).join(", ") || "Indirizzo non indicato"}</div>
              <div>
                {profile.billing_vat ? `P.IVA ${profile.billing_vat}` : profile.billing_tax_code ? `CF ${profile.billing_tax_code}` : "Nessun codice fiscale o partita IVA"}
              </div>
              <div>{profile.billing_sdi ? `SDI ${profile.billing_sdi}` : profile.billing_pec ? `PEC ${profile.billing_pec}` : "Nessun recapito elettronico"}</div>
            </div>
          </Card>
        ) : null}

        {/* Soldi in tre numeri: la domanda «questo cliente ha pagato?» si
            rispondeva solo scorrendo fino in fondo, fra addebiti, incassi e
            capi speciali sparsi in tre riquadri diversi. */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Soldi</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[14px] bg-ice px-2 py-3">
              <div className="font-display text-lg font-black text-navy">{eur(totaleIncassatoCents)}</div>
              <div className="mt-0.5 text-[11px] font-semibold leading-tight text-muted">Incassato</div>
            </div>
            <div className="rounded-[14px] bg-ice px-2 py-3">
              <div className="font-display text-lg font-black text-navy">{eur(addebitatoCents - stornatoCents)}</div>
              <div className="mt-0.5 text-[11px] font-semibold leading-tight text-muted">Addebiti netti</div>
            </div>
            <div className="rounded-[14px] bg-ice px-2 py-3">
              <div className="font-display text-lg font-black text-navy">{capi.length}</div>
              <div className="mt-0.5 text-[11px] font-semibold leading-tight text-muted">Capi extra</div>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-sm font-medium text-muted">
            {stripeSub?.prossimoAddebito ? (
              <div>Prossimo addebito: <span className="font-bold text-navy">{fmtDate(stripeSub.prossimoAddebito.data)}</span> · {eur(stripeSub.prossimoAddebito.importoCents)}</div>
            ) : (
              <div>Nessun addebito futuro programmato.</div>
            )}
            <div>Ordini: <span className="font-bold text-navy">{orders?.length ?? 0}</span> · ritiri ricorrenti attivi: <span className="font-bold text-navy">{(recurring ?? []).filter((r) => r.active).length}</span></div>
          </div>
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
      <Sezione titolo="Crea un ritiro per il cliente" nota="per chi prenota al telefono">
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
      </Sezione>

      {/* Ritiri ricorrenti — orari indicati dal cliente, modificabili dall'admin */}
      <Sezione titolo="Ritiri ricorrenti" conteggio={(recurring ?? []).length}>
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
      </Sezione>

      {/* Storico pagamenti, riga per riga, direttamente da Stripe.
          Il registro locale `invoices` parte da agosto 2026 e i pagamenti
          precedenti non ci sono: questo elenco copre tutta la vita del cliente,
          e soprattutto mostra QUALE fattura è rimasta aperta — che è la domanda
          che ci si fa quando arriva la telefonata. */}
      {stripeSub && !stripeSub.errore && (
        <Sezione titolo="Storico pagamenti" conteggio={stripeSub.fatture.length} nota="da Stripe, riga per riga">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
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
        </Sezione>
      )}

      {/* Addebiti / rimborsi personalizzati */}
      <Sezione titolo="Addebiti e storni" nota="extra fuori ordine, modifiche, crediti">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
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
      </Sezione>

      {/* Incassi e ricevute. La tabella esisteva già e la scheda non la
          leggeva: per sapere se un cliente aveva pagato bisognava aprire
          Stripe. Si scrive "ricevuta": la fattura è l'eccezione, e si nomina
          solo dove esiste davvero. */}
      <Sezione titolo="Incassi e ricevute" conteggio={incassi.length}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
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
      </Sezione>

      {/* Capi fuori abbonamento: prima si vedevano solo entrando nel singolo ordine */}
      {capi.length > 0 && (
        <Sezione titolo="Capi fuori abbonamento" conteggio={capi.length}>
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
        </Sezione>
      )}

      {/* Ordini */}
      <Sezione titolo="Ordini" conteggio={orders?.length ?? 0}>
        <div className="mt-3 space-y-2">
          {(orders ?? []).length === 0 ? (
            <p className="text-sm font-medium text-muted">Nessun ordine.</p>
          ) : (
            (orders ?? []).map((o) => (
              <RigaOrdine key={o.id} o={o} customerId={id} />
            ))
          )}
        </div>
      </Sezione>

      {/* Elimina lead / cliente */}
      <Sezione titolo="Elimina cliente" nota="irreversibile">
        <p className="mt-1 text-xs font-medium text-muted">
          Rimuove definitivamente il cliente e tutti i suoi dati (profilo, indirizzi, abbonamento, addebiti e ordini chiusi). Operazione irreversibile.
        </p>
        {bloccoElimina ? (
          /* Il muro si mostra PRIMA, insieme a quello che serve per abbatterlo:
             prima il bottone rosso c'era comunque, e la conferma «sei sicuro»
             finiva su un avviso che diceva solo «annullali». */
          <div className="mt-3 rounded-[14px] border border-[#C9881F]/30 bg-[#C9881F]/8 p-3">
            <p className="font-display text-sm font-bold text-[#C9881F]">Non si può eliminare, per ora</p>
            <p className="mt-1 text-xs font-semibold text-[#C9881F]">{bloccoElimina}</p>
            {ordiniAperti.length > 0 && (
              <div className="mt-2.5 space-y-2">
                {ordiniAperti.map((o) => (
                  <RigaOrdine key={o.id} o={o} customerId={id} />
                ))}
              </div>
            )}
          </div>
        ) : (
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
        )}
      </Sezione>
    </>
  );
}

/** Una riga della lista ordini: chi è, quando passiamo, a che punto è.
 *
 *  Il bottone "Annulla" c'è solo sugli ordini ancora aperti, ed è quello che
 *  mancava: un cliente con un ordine in ballo non si poteva eliminare, e per
 *  chiudere quell'ordine bisognava sapere che si passa dal board. Da qui si fa
 *  e si resta sulla scheda.
 *
 *  Il link non avvolge tutta la riga perché dentro c'è un form: un <form>
 *  dentro un <a> non è HTML valido. */
function RigaOrdine({ o, customerId }: { o: Ord; customerId: string }) {
  const aperto = ordineAperto(o.status);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-white px-3 py-2 text-sm">
      <Link href={`/admin/ordini/${o.id}`} className="flex flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 transition-colors hover:text-blue">
        <span className="font-bold text-navy">#{o.id.slice(0, 8)}</span>
        {/* Data del RITIRO e stato in italiano: qui comparivano la data della
            prenotazione e la parola grezza del database («pickup_scheduled»),
            che non dicono niente a chi legge. */}
        <span className="text-muted">
          {o.bags} {o.bags === 1 ? "sacco" : "sacchi"} ·{" "}
          {o.pickup_slot?.starts_at ? `ritiro ${fmtDate(o.pickup_slot.starts_at)}` : `prenotato ${fmtDate(o.created_at)}`}
        </span>
        <span className="font-display text-xs font-bold text-blue">{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
      </Link>
      {aperto && (
        <form action={cancelOrder}>
          <input type="hidden" name="order_id" value={o.id} />
          <input type="hidden" name="back" value={`/admin/abbonati/${customerId}`} />
          <button type="submit" className="shrink-0 rounded-full border border-[#C0392B]/40 px-3 py-1 font-display text-xs font-bold text-[#C0392B] transition-colors hover:bg-[#C0392B]/5">
            Annulla
          </button>
        </form>
      )}
    </div>
  );
}

/** Sezione richiudibile.
 *
 *  La scheda aveva undici riquadri impilati e si scorreva all'infinito: per
 *  sapere se un cliente aveva pagato bisognava passare in mezzo agli indirizzi,
 *  alle ricorrenze e agli addebiti. Ora sopra c'è tutto quello che serve a
 *  rispondere «chi è, paga, cosa aspetta», e il resto sta qui dentro, a un
 *  clic — con il numero già scritto nel titolo, così spesso non serve nemmeno
 *  aprirlo. */
function Sezione({
  titolo,
  conteggio,
  nota,
  apertaSubito = false,
  children,
}: {
  titolo: string;
  conteggio?: number | string;
  nota?: string;
  apertaSubito?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={apertaSubito} className="group mt-3 rounded-[18px] border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5">
        <span className="font-display text-base font-extrabold text-navy">{titolo}</span>
        {conteggio !== undefined && (
          <span className="rounded-full bg-ice px-2.5 py-0.5 font-display text-xs font-extrabold text-navy/70">{conteggio}</span>
        )}
        {nota && <span className="truncate text-xs font-medium text-muted">{nota}</span>}
        <span className="ml-auto font-display text-xs font-bold text-blue">
          <span className="group-open:hidden">Apri</span>
          <span className="hidden group-open:inline">Chiudi</span>
        </span>
      </summary>
      <div className="border-t border-line px-5 py-4">{children}</div>
    </details>
  );
}
