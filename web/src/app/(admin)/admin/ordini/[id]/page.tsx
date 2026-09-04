import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/Button";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { advanceStatus, assignOrder, setEta, scheduleDelivery, spostaRitiro } from "@/lib/actions/orders";
import { setStaffNotes, cancelOrder } from "@/lib/actions/items";
import { DeleteOrderButton } from "@/components/admin/DeleteOrderButton";
import { chargeOrderSpecials, refundOrderSpecial, addSpecialAdmin } from "@/lib/actions/charge";
import { AdminItems, type Item } from "@/components/app/AdminItems";
import { SegnalazioneRiga, type Segnalazione } from "@/components/app/SegnalazioneRiga";
import { pubblicaSegnalazione, chiudiSegnalazione } from "@/lib/actions/segnalazioni";
import { signedProofUrl } from "@/lib/orders";
import { AddSpecialForm, type ListItem } from "@/components/app/AddSpecialForm";
import { ORDER_FLOW, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";
import { fmtFull, fmtSlot, toRomeInputValue } from "@/lib/format";
import { deliveryCounts, pickupCounts } from "@/lib/slots";

type Order = {
  id: string;
  status: OrderStatus;
  bags: number;
  notes: string | null;
  staff_notes: string | null;
  created_at: string;
  courier_id: string | null;
  laundry_id: string | null;
  customer_id: string | null;
  eta_ready_at: string | null;
  delivery_slot_id: string | null;
  delivery_slot: { starts_at: string; ends_at: string } | null;
  pickup_slot_id: string | null;
  pickup_slot: { starts_at: string; ends_at: string } | null;
  customer: { full_name: string | null; phone: string | null } | null;
  addresses: { street: string; intercom: string | null; floor: string | null; zones: { name: string } | null } | null;
};

type Event = { id: string; status: OrderStatus; created_at: string; note: string | null };
type Person = { id: string; full_name: string | null };
type Laundry = { id: string; name: string };
type DeliverySlot = { id: string; starts_at: string; ends_at: string; capacity: number | null; presi?: number };
type Special = { id: string; item_name: string; qty: number; price_cli_cents: number; charged_at: string | null; refunded_at: string | null };

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";
const STATUSES: OrderStatus[] = [...ORDER_FLOW, "cancelled"];
const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  const { id } = await params;
  const { err } = await searchParams;
  const supabase = await createClient();

  const [{ data: order }, { data: events }, { data: couriers }, { data: laundries }, { data: items }, { data: issues }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, bags, notes, staff_notes, created_at, courier_id, laundry_id, customer_id, eta_ready_at, delivery_slot_id, pickup_slot_id, customer:profiles!orders_customer_id_fkey(full_name, phone), addresses(street, intercom, floor, zones(name)), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at), pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at, ends_at)")
      .eq("id", id)
      .maybeSingle<Order>(),
    supabase.from("order_events").select("id, status, created_at, note").eq("order_id", id).order("created_at", { ascending: false }).returns<Event[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "courier").returns<Person[]>(),
    supabase.from("laundries").select("id, name").eq("active", true).returns<Laundry[]>(),
    supabase.from("order_items").select("id, kind, status, photo_url").eq("order_id", id).order("created_at").returns<Item[]>(),
    supabase
      .from("order_issues")
      .select("id, kind, capo, testo, photo_url, created_at, published_at, resolved_at, resolution, trattenuto_at, restituito_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .returns<Segnalazione[]>(),
  ]);

  // Fasce di riconsegna selezionabili: future e, se l'ordine ha gia' una
  // lavanderia, solo le sue. La riconsegna la programmiamo noi da qui.
  let fasceConsegna: DeliverySlot[] = [];
  if (order) {
    let q = supabase
      .from("slots")
      .select("id, starts_at, ends_at, capacity")
      .eq("kind", "delivery")
      .is("archived_at", null)
      .gte("starts_at", new Date().toISOString());
    if (order.laundry_id) q = q.eq("laundry_id", order.laundry_id);
    const { data: raw } = await q.order("starts_at").limit(20).returns<DeliverySlot[]>();
    const usati = await deliveryCounts(supabase, (raw ?? []).map((s) => s.id));
    fasceConsegna = (raw ?? []).map((s) => ({ ...s, presi: usati.get(s.id) ?? 0 }));
  }

  // Fasce di RITIRO: finché il sacco non è stato preso, la data si sposta anche
  // da qui. Prima si poteva cambiare solo la riconsegna, e un ritiro sbagliato
  // si poteva solo annullare e rifare da capo.
  let fasceRitiro: DeliverySlot[] = [];
  const ritiroSpostabile = !!order && (order.status === "requested" || order.status === "pickup_scheduled");
  if (order && ritiroSpostabile) {
    let q = supabase
      .from("slots")
      .select("id, starts_at, ends_at, capacity")
      .eq("kind", "pickup")
      .is("archived_at", null)
      .gte("starts_at", new Date().toISOString());
    if (order.laundry_id) q = q.eq("laundry_id", order.laundry_id);
    const { data: raw } = await q.order("starts_at").limit(20).returns<DeliverySlot[]>();
    const usati = await pickupCounts(supabase, (raw ?? []).map((s) => s.id));
    fasceRitiro = (raw ?? []).map((s) => ({ ...s, presi: usati.get(s.id) ?? 0 }));
  }

  // Bucket privato: le foto prova si servono con link firmato a scadenza.
  const itemsFirmati = await Promise.all(
    (items ?? []).map(async (it) => ({ ...it, photo_url: await signedProofUrl(supabase, it.photo_url) })),
  );
  const segnalazioni = await Promise.all(
    (issues ?? []).map(async (sg) => ({ ...sg, fotoUrl: await signedProofUrl(supabase, sg.photo_url) })),
  );
  const daAvvisare = segnalazioni.filter((sg) => !sg.published_at).length;

  const { data: specials } = await supabase
    .from("order_specials")
    .select("id, item_name, qty, price_cli_cents, charged_at, refunded_at")
    .eq("order_id", id)
    .order("created_at")
    .returns<Special[]>();

  // Listino capi per il form "aggiungi capo" (vista admin → prezzo cliente).
  // Service role: `special_items` non è più leggibile con la sessione utente,
  // perché conteneva anche il compenso lavanderia ed era esposta a chiunque.
  // La pagina sta sotto il layout (admin), che rimanda al login chi non è admin.
  const { data: catItems } = await createServiceClient()
    .from("special_items")
    .select("id, name, price_cli_cents, comp_lav_cents, special_categories(id, name, emoji)")
    .eq("active", true)
    .order("sort")
    .returns<{ id: string; name: string; price_cli_cents: number; comp_lav_cents: number; special_categories: { id: string; name: string; emoji: string } | null }[]>();
  const listItems: ListItem[] = (catItems ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    category_id: i.special_categories?.id ?? "x",
    category_name: i.special_categories?.name ?? "Capi",
    category_emoji: i.special_categories?.emoji ?? "👕",
    comp_lav_cents: i.comp_lav_cents,
    price_cli_cents: i.price_cli_cents,
  }));

  if (!order) notFound();

  const specialRows = specials ?? [];
  const pendingTotal = specialRows.filter((s) => !s.charged_at).reduce((t, s) => t + s.price_cli_cents * s.qty, 0);

  return (
    <>
      <PageTitle kicker={`Ordine #${order.id.slice(0, 8)}`} title={order.customer?.full_name ?? "Cliente"} />

      {err && (
        <div className="mb-4 rounded-[16px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{err}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Colonna gestione */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-extrabold text-navy">Dettagli</span>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-4 space-y-1.5 text-sm font-medium text-muted">
              <div>Cliente: {order.customer?.full_name ?? "—"} {order.customer?.phone && `· ${order.customer.phone}`}</div>
              <div>Indirizzo: {order.addresses?.street} {order.addresses?.zones?.name && `(${order.addresses.zones.name})`}</div>
              {(order.addresses?.floor || order.addresses?.intercom) && (
                <div>{order.addresses?.floor && `Piano ${order.addresses.floor}`} {order.addresses?.intercom && `· Citofono ${order.addresses.intercom}`}</div>
              )}
              <div>{order.bags} {order.bags === 1 ? "busta" : "buste"} · {fmtFull(order.created_at)}</div>
              {order.notes && <div>Note: {order.notes}</div>}
            </div>
            <a href={`/admin/etichette?c=${order.customer_id ?? ""}&n=2`} className="mt-3 inline-block font-display text-sm font-bold text-blue hover:underline">
              🖨 Tag del cliente (QR)
            </a>
          </Card>

          <Card>
            <span className="font-display text-sm font-extrabold text-navy">Assegna</span>
            <form action={assignOrder} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="order_id" value={order.id} />
              <select name="courier_id" className={input} defaultValue={order.courier_id ?? ""}>
                <option value="">Corriere…</option>
                {(couriers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name ?? c.id.slice(0, 8)}</option>
                ))}
              </select>
              <select name="laundry_id" className={input} defaultValue={order.laundry_id ?? ""}>
                <option value="">Lavanderia…</option>
                {(laundries ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <Button type="submit" size="md" variant="ghost-navy" className="sm:col-span-2">
                Salva assegnazione
              </Button>
            </form>
          </Card>

          <Card>
            <span className="font-display text-sm font-extrabold text-navy">Pronto previsto (ETA)</span>
            <p className="mt-1 text-xs font-medium text-muted">Quando saranno pronti i capi. Il cliente lo vede nel tracking.</p>
            <form action={setEta} className="mt-3 flex gap-3">
              <input type="hidden" name="order_id" value={order.id} />
              <input type="datetime-local" name="eta_ready_at" defaultValue={toRomeInputValue(order.eta_ready_at)} className={input} />
              <Button type="submit" size="md" variant="ghost-navy">
                Salva ETA
              </Button>
            </form>
          </Card>

          {ritiroSpostabile && (
            <Card>
              <span className="font-display text-sm font-extrabold text-navy">Ritiro</span>
              <p className="mt-1 text-xs font-medium text-muted">
                Si sposta finché il sacco non è stato preso. Il cliente lo può fare anche da solo dalla sua app:
                qui serve quando chiama e non vuole farlo lui.
              </p>
              {order.pickup_slot && (
                <p className="mt-2 rounded-[12px] bg-ice px-3 py-2 text-sm font-bold text-navy">
                  Adesso: {fmtSlot(order.pickup_slot.starts_at, order.pickup_slot.ends_at)}
                </p>
              )}
              {fasceRitiro.length > 0 ? (
                <form action={spostaRitiro} className="mt-3 flex gap-3">
                  <input type="hidden" name="order_id" value={order.id} />
                  <select name="pickup_slot_id" required className={input} defaultValue={order.pickup_slot_id ?? ""}>
                    <option value="" disabled>Fascia di ritiro…</option>
                    {fasceRitiro.map((s) => {
                      const pieno = s.capacity != null && (s.presi ?? 0) >= s.capacity && s.id !== order.pickup_slot_id;
                      return (
                        <option key={s.id} value={s.id} disabled={pieno}>
                          {fmtSlot(s.starts_at, s.ends_at)}
                          {s.capacity != null ? ` — ${Math.max(0, s.capacity - (s.presi ?? 0))} posti` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <Button type="submit" size="md" variant="ghost-navy">Sposta</Button>
                </form>
              ) : (
                <p className="mt-3 rounded-[12px] bg-ice px-3 py-2 text-sm font-medium text-muted">
                  Nessuna fascia di ritiro futura per questa lavanderia: generane in Catalogo.
                </p>
              )}
            </Card>
          )}

          <Card>
            <span className="font-display text-sm font-extrabold text-navy">Riconsegna</span>
            <p className="mt-1 text-xs font-medium text-muted">
              Di norma la fascia la sceglie il cliente in prenotazione e la trovi già fissata qui sotto. Qui la si
              cambia, o la si mette quando il cliente non ha scelto (nessuna fascia libera dopo la lavorazione).
              Al salvataggio l&apos;ordine passa a &laquo;in consegna programmata&raquo; e il cliente riceve giorno e ora.
            </p>
            {order.delivery_slot && (
              <p className="mt-2 rounded-[12px] bg-ice px-3 py-2 text-sm font-bold text-navy">
                Fissata: {fmtSlot(order.delivery_slot.starts_at, order.delivery_slot.ends_at)}
              </p>
            )}
            {fasceConsegna.length > 0 ? (
              <form action={scheduleDelivery} className="mt-3 flex gap-3">
                <input type="hidden" name="order_id" value={order.id} />
                <select name="delivery_slot_id" required className={input} defaultValue={order.delivery_slot_id ?? ""}>
                  <option value="" disabled>Fascia di consegna…</option>
                  {fasceConsegna.map((s) => {
                    const pieno = s.capacity != null && (s.presi ?? 0) >= s.capacity;
                    return (
                      <option key={s.id} value={s.id} disabled={pieno}>
                        {fmtSlot(s.starts_at, s.ends_at)}
                        {s.capacity != null ? ` — ${Math.max(0, s.capacity - (s.presi ?? 0))} posti` : ""}
                      </option>
                    );
                  })}
                </select>
                <Button type="submit" size="md" variant="ghost-navy">
                  {order.delivery_slot_id ? "Sposta" : "Programma"}
                </Button>
              </form>
            ) : (
              <p className="mt-3 rounded-[12px] bg-ice px-3 py-2 text-sm font-medium text-muted">
                Nessuna fascia di consegna futura per questa lavanderia: generane in Catalogo.
              </p>
            )}
          </Card>

          <Card>
            <span className="font-display text-sm font-extrabold text-navy">Avanza stato</span>
            <form action={advanceStatus} className="mt-3 flex gap-3">
              <input type="hidden" name="order_id" value={order.id} />
              <select name="status" className={input} defaultValue={order.status}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
                ))}
              </select>
              <Button type="submit" size="md">
                Aggiorna
              </Button>
            </form>
          </Card>

          <Card>
            <AdminItems orderId={order.id} items={itemsFirmati} />
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-extrabold text-navy">Capi speciali (addebito cliente)</span>
              {pendingTotal > 0 && <span className="font-display text-sm font-black text-navy">{eur(pendingTotal)} da addebitare</span>}
            </div>
            <div className="mt-3 rounded-[12px] border border-line bg-ice p-3">
              <div className="mb-2 font-display text-xs font-extrabold uppercase tracking-wide text-blue">Aggiungi capo</div>
              <AddSpecialForm orderId={order.id} items={listItems} action={addSpecialAdmin} customerView />
            </div>
            {specialRows.length === 0 ? (
              <p className="mt-3 text-sm font-medium text-muted">Nessun capo speciale su questo ordine.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {specialRows.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-ice px-3 py-2 text-sm">
                    <span className="font-semibold text-navy">{s.qty}× {s.item_name}</span>
                    <span className="flex items-center gap-2">
                      <span className={`font-display font-bold ${s.refunded_at ? "text-muted line-through" : "text-navy"}`}>{eur(s.price_cli_cents * s.qty)}</span>
                      {s.refunded_at ? (
                        <span className="rounded-full bg-navy/10 px-2 py-0.5 font-display text-xs font-extrabold text-navy">rimborsato</span>
                      ) : s.charged_at ? (
                        <>
                          <span className="rounded-full bg-[#1F8A5B]/15 px-2 py-0.5 font-display text-xs font-extrabold text-[#1F8A5B]">in fattura</span>
                          <form action={refundOrderSpecial}>
                            <input type="hidden" name="special_id" value={s.id} />
                            <button type="submit" className="font-display text-xs font-bold text-[#C0392B] hover:underline">Rimborsa</button>
                          </form>
                        </>
                      ) : (
                        <span className="rounded-full bg-[#E08A00]/15 px-2 py-0.5 font-display text-xs font-extrabold text-[#E08A00]">in attesa</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {pendingTotal > 0 && (
              <form action={chargeOrderSpecials} className="mt-3">
                <input type="hidden" name="order_id" value={order.id} />
                <Button type="submit" size="md" className="w-full">Metti in fattura {eur(pendingTotal)} (addebito automatico)</Button>
              </form>
            )}
            {pendingTotal > 0 && (
              <p className="mt-2 text-xs font-medium text-muted">
                Aggiunti alla prossima fattura dell&apos;abbonamento: addebito automatico sulla carta già accettata, senza richieste al cliente.
              </p>
            )}
          </Card>

          <Card>
            <span className="font-display text-sm font-extrabold text-navy">Note interne</span>
            <p className="mt-1 text-xs font-medium text-muted">Visibili solo allo staff, mai al cliente.</p>
            <form action={setStaffNotes} className="mt-3 space-y-2">
              <input type="hidden" name="order_id" value={order.id} />
              <textarea name="staff_notes" rows={3} defaultValue={order.staff_notes ?? ""} placeholder="Es. macchia ostinata sul colletto…" className={`${input} h-auto py-2`} />
              <Button type="submit" size="md" variant="ghost-navy">Salva note</Button>
            </form>
          </Card>

          {order.status !== "cancelled" && order.status !== "delivered" && order.status !== "completed" ? (
            <form action={cancelOrder}>
              <input type="hidden" name="order_id" value={order.id} />
              <button type="submit" className="font-display text-sm font-bold text-[#C0392B] hover:underline">
                Annulla ordine
              </button>
            </form>
          ) : (
            // Un ordine chiuso si può togliere di mezzo: serve per i dati di prova.
            <DeleteOrderButton id={order.id} code={`#${order.id.slice(0, 8)}`} />
          )}
        </div>

        {/* Segnalazioni della lavanderia.
            I danni in lavorazione arrivano qui SENZA essere stati comunicati al
            cliente: la lavanderia li scrive, noi decidiamo cosa proporre e poi
            pubblichiamo. Finché il bottone «Avvisa il cliente» è lì, lui non sa
            niente — quindi la card lo dice a chiare lettere invece di mostrare
            una spunta ambigua. */}
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-sm font-extrabold text-navy">Segnalazioni della lavanderia</span>
            {daAvvisare > 0 && (
              <span className="rounded-full bg-[#C0392B]/12 px-2.5 py-1 font-display text-xs font-bold text-[#C0392B]">
                {daAvvisare} da comunicare al cliente
              </span>
            )}
          </div>

          {segnalazioni.length === 0 ? (
            <p className="mt-3 text-sm font-medium text-muted">Nessuna segnalazione su questo ordine.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {segnalazioni.map((sg) => (
                <SegnalazioneRiga key={sg.id} s={sg} fotoUrl={sg.fotoUrl}>
                  <div className="mt-3 space-y-2 border-t border-line/70 pt-3">
                    {!sg.published_at && (
                      <form action={pubblicaSegnalazione}>
                        <input type="hidden" name="issue_id" value={sg.id} />
                        <input type="hidden" name="order_id" value={order.id} />
                        <p className="mb-2 text-xs font-medium text-muted">
                          Prima di premere: decidi cosa proponi (rimborso, rilavaggio, sostituzione) e scrivilo al
                          cliente. Da qui parte solo l&apos;avviso con il testo della lavanderia.
                        </p>
                        <button type="submit" className="font-display text-sm font-extrabold text-blue hover:underline">
                          Avvisa il cliente →
                        </button>
                      </form>
                    )}
                    {!sg.resolved_at && (
                      <form action={chiudiSegnalazione} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="issue_id" value={sg.id} />
                        <input type="hidden" name="order_id" value={order.id} />
                        <input
                          name="resolution"
                          maxLength={200}
                          placeholder="Come è finita (es. rimborsata la camicia, €35)"
                          className="min-w-0 flex-1 rounded-[10px] border border-line bg-white px-3 py-2 text-sm font-medium text-navy outline-none focus:border-blue"
                        />
                        <button type="submit" className="font-display text-sm font-bold text-navy/70 hover:text-navy">
                          Chiudi
                        </button>
                      </form>
                    )}
                  </div>
                </SegnalazioneRiga>
              ))}
            </div>
          )}
        </Card>

        {/* Timeline eventi */}
        <Card>
          <span className="font-display text-sm font-extrabold text-navy">Cronologia</span>
          <ol className="mt-4 space-y-3">
            {(events ?? []).map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-blue" />
                <div>
                  <div className="font-display text-sm font-bold text-navy">{ORDER_STATUS_LABEL[e.status]}</div>
                  <div className="text-xs font-medium text-muted">{fmtFull(e.created_at)}</div>
                </div>
              </li>
            ))}
            {(!events || events.length === 0) && <li className="text-sm font-medium text-muted">Nessun evento.</li>}
          </ol>
        </Card>
      </div>
    </>
  );
}
