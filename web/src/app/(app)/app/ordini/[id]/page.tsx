import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTimeline } from "@/components/app/OrderTimeline";
import { LiveRider } from "@/components/app/LiveRider";
import { StatusBadge } from "@/components/app/StatusBadge";
import { SegnalazioneRiga, type Segnalazione } from "@/components/app/SegnalazioneRiga";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { signedProofUrl, statusIndex, ORDER_STATUS_LABEL, ITEM_STATUS_LABEL, type OrderStatus, type ItemStatus } from "@/lib/orders";
import { fmtDate, fmtFull, eurCents } from "@/lib/format";
import { spostaRitiro, clienteDisdiceRitiro } from "@/lib/actions/orders";
import { pickupCounts } from "@/lib/slots";
import { BottoneInvio } from "@/components/ui/BottoneInvio";

type Item = { id: string; kind: string | null; status: ItemStatus; photo_url: string | null };

const itemTone: Record<ItemStatus, string> = {
  received: "bg-navy/10 text-navy",
  washing: "bg-cyan/20 text-navy",
  ready: "bg-[#1F8A5B]/15 text-[#1F8A5B]",
  issue: "bg-[#C0392B]/12 text-[#C0392B]",
};

type Order = {
  id: string;
  status: OrderStatus;
  bags: number;
  notes: string | null;
  created_at: string;
  delivery_slot_id: string | null;
  laundry_id: string | null;
  eta_ready_at: string | null;
  addresses: { street: string; label: string | null } | null;
  delivery_slot: { starts_at: string; ends_at: string } | null;
  pickup_slot: { id: string; starts_at: string; ends_at: string } | null;
  pickup_slot_id: string | null;
  laundry: { id: string } | null;
};
const ChevLeft = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string; ok?: string }> }) {
  const { id } = await params;
  const { err, ok } = await searchParams;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, bags, notes, created_at, delivery_slot_id, pickup_slot_id, laundry_id, eta_ready_at, addresses(street, label), delivery_slot:slots!orders_delivery_slot_id_fkey(starts_at, ends_at), pickup_slot:slots!orders_pickup_slot_id_fkey(id, starts_at, ends_at)")
    .eq("id", id)
    .maybeSingle<Order>();

  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, kind, status, photo_url")
    .eq("order_id", id)
    .order("created_at")
    .returns<Item[]>();

  // I capi speciali addebitati su questo ritiro.
  //
  // Finora non comparivano da nessuna parte nell'area del cliente: l'unico
  // avviso era un'email al momento dell'addebito, e se quella non arriva la
  // persona si trova un importo in più sulla fattura senza sapere perché.
  // Un addebito che il cliente non può rileggere quando vuole non è
  // trasparente, è una sorpresa.
  //
  // `comp_lav_cents` non si chiede di proposito: è quanto paghiamo noi alla
  // lavanderia e il permesso di colonna lo nega al cliente.
  const { data: specials } = await supabase
    .from("order_specials")
    .select("id, item_name, qty, price_cli_cents, charged_at, refunded_at, created_at")
    .eq("order_id", id)
    .order("created_at")
    .returns<{ id: string; item_name: string; qty: number; price_cli_cents: number; charged_at: string | null; refunded_at: string | null; created_at: string }[]>();
  const extra = (specials ?? []).filter((x) => !x.refunded_at);
  const totaleExtraCents = extra.reduce((t, x) => t + x.price_cli_cents * x.qty, 0);

  // Segnalazioni della lavanderia. La policy lascia passare al cliente solo
  // quelle pubblicate: i danni in lavorazione arrivano qui dopo che l'ops ha
  // deciso cosa proporre, non nel momento in cui la lavanderia se ne accorge.
  const { data: issues } = await supabase
    .from("order_issues")
    .select("id, kind, capo, testo, photo_url, created_at, published_at, resolved_at, resolution, trattenuto_at, restituito_at")
    .eq("order_id", id)
    .not("published_at", "is", null)
    .order("created_at", { ascending: false })
    .returns<Segnalazione[]>();
  // Le foto stanno in un bucket privato e si firmano lato server.
  const svcFoto = createServiceClient();
  const segnalazioni = await Promise.all(
    (issues ?? []).map(async (s) => ({ ...s, fotoUrl: await signedProofUrl(svcFoto, s.photo_url) })),
  );

  // Il bucket è privato: ogni foto diventa un link firmato a scadenza breve.
  const itemsFirmati = await Promise.all(
    (items ?? []).map(async (it) => ({ ...it, photo_url: await signedProofUrl(supabase, it.photo_url) })),
  );

  // La riconsegna la programmiamo noi quando la lavanderia ha finito: il cliente
  // non sceglie la fascia, la riceve. Qui mostriamo solo a che punto siamo.
  const prontoDaConsegnare = statusIndex(order.status) >= statusIndex("ready");
  const consegnaFissata = order.delivery_slot;

  const inProgress = statusIndex(order.status) < statusIndex("delivered");

  // Finché il sacco è ancora a casa, la data si cambia e il ritiro si disdice.
  // Prima non si poteva fare niente delle due, e l'unica strada era scriverci.
  const modificabile = order.status === "requested" || order.status === "pickup_scheduled";
  let alternative: { id: string; starts_at: string; ends_at: string; liberi: number }[] = [];
  if (modificabile) {
    const { data: slots } = await supabase
      .from("slots")
      .select("id, starts_at, ends_at, capacity")
      .eq("kind", "pickup")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(30)
      .returns<{ id: string; starts_at: string; ends_at: string; capacity: number | null }[]>();
    const occupati = await pickupCounts(supabase, (slots ?? []).map((s) => s.id));
    alternative = (slots ?? [])
      .map((s) => ({ ...s, liberi: (s.capacity ?? 0) - (occupati.get(s.id) ?? 0) }))
      // La fascia attuale resta in elenco: si vede dov'è, e la si può riscegliere.
      .filter((s) => s.id === order.pickup_slot_id || s.liberi > 0)
      .slice(0, 12);
  }

  return (
    <div className="space-y-4">
      {/* Back bar */}
      <div className="flex items-center gap-3">
        <Link href="/app/ordini" aria-label="Indietro" className="grid h-11 w-11 place-items-center rounded-full bg-white text-navy shadow-[0_1px_0_rgba(27,45,94,0.04),0_10px_24px_-18px_rgba(27,45,94,0.5)]">
          <ChevLeft />
        </Link>
        <h1 className="font-display text-lg font-black tracking-[-0.02em] text-navy">Ritiro e consegna</h1>
      </div>

      {err && (
        <div className="rounded-[16px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{err}</div>
      )}
      {ok && (
        <div className="rounded-[16px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/10 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>
      )}

      {/* Status hero */}
      <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#26417a] to-[#16264f] p-6 text-white shadow-[0_18px_44px_-26px_rgba(27,45,94,0.7)]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-cyan/20 blur-2xl" />
        <div className="flex items-center justify-between">
          <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-cyan">A che punto siamo</div>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-2 font-display text-[24px] font-black leading-tight">{ORDER_STATUS_LABEL[order.status]}</div>
        <p className="mt-1.5 text-sm font-medium text-white/70">
          {order.eta_ready_at && inProgress
            ? `Pronto entro ${fmtFull(order.eta_ready_at)}`
            : `${order.bags} ${order.bags === 1 ? "sacco" : "sacchi"} · creato il ${fmtDate(order.created_at)}`}
        </p>
      </section>

      {/* Rider live (solo ritiro imminente / in consegna, e solo quando è vicino) */}
      {(order.status === "out_for_delivery" || order.status === "pickup_scheduled") && (
        <section className="rounded-[18px] border border-line bg-white p-5">
          <div className="mb-3 font-display text-sm font-extrabold text-navy">Il tuo rider</div>
          <LiveRider orderId={order.id} />
        </section>
      )}

      {/* Dettaglio + timeline */}
      <section className="rounded-[18px] border border-line bg-white p-5">
        <div className="space-y-1.5 text-sm font-medium text-muted">
          {order.addresses?.street && (
            <div>Ritiro: {order.addresses.label ? `${order.addresses.label} — ` : ""}{order.addresses.street}</div>
          )}
          {order.notes && <div>Note: {order.notes}</div>}
        </div>
        <div className="my-4 h-px bg-line" />
        <div className="font-display text-sm font-extrabold text-navy">Avanzamento</div>
        <div className="mt-4">
          <OrderTimeline orderId={order.id} initialStatus={order.status} />
        </div>
      </section>

      {/* Cambiare idea è normale: si sposta la fascia o si disdice, finché il
          sacco è ancora a casa. Dopo il ritiro sparisce, perché il bucato è già
          in viaggio e non sarebbe più una promessa che possiamo mantenere. */}
      {modificabile && (
        <section className="rounded-[18px] border border-line bg-white p-5">
          <div className="font-display text-sm font-extrabold text-navy">Cambia o annulla il ritiro</div>
          {order.pickup_slot && (
            <p className="mt-1 text-sm font-medium text-muted">
              Adesso passiamo <span className="font-bold text-navy">{fmtFull(order.pickup_slot.starts_at)}</span>.
            </p>
          )}

          {alternative.length > 0 ? (
            <form action={spostaRitiro} className="mt-3 space-y-2">
              <input type="hidden" name="order_id" value={order.id} />
              <input type="hidden" name="da" value="cliente" />
              <label className="block text-xs font-bold text-muted">
                Nuova fascia
                <select
                  name="pickup_slot_id"
                  defaultValue={order.pickup_slot_id ?? ""}
                  className="mt-1 h-11 w-full rounded-[14px] border border-line bg-ice px-3 text-sm font-semibold text-navy outline-none focus:border-blue"
                >
                  {alternative.map((s) => (
                    <option key={s.id} value={s.id}>
                      {fmtFull(s.starts_at)}
                      {s.id === order.pickup_slot_id ? " · attuale" : ` · ${s.liberi} ${s.liberi === 1 ? "posto" : "posti"}`}
                    </option>
                  ))}
                </select>
              </label>
              <BottoneInvio className="h-11 w-full rounded-full bg-gradient-to-br from-blue to-cyan font-display text-sm font-extrabold text-white">
                Sposta il ritiro
              </BottoneInvio>
            </form>
          ) : (
            <p className="mt-3 rounded-[14px] bg-ice p-3 text-sm font-medium text-muted">
              Non ci sono altre fasce libere al momento. Scrivici e troviamo noi una soluzione.
            </p>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold text-[#C0392B]">Non ti serve più? Annulla il ritiro</summary>
            <form action={clienteDisdiceRitiro} className="mt-2 flex items-center gap-2">
              <input type="hidden" name="order_id" value={order.id} />
              <span className="text-xs font-semibold text-navy">Confermi di annullarlo?</span>
              <BottoneInvio className="rounded-full bg-[#C0392B] px-4 py-1.5 font-display text-xs font-extrabold text-white">
                Sì, annulla
              </BottoneInvio>
            </form>
          </details>
        </section>
      )}

      {/* Riconsegna. La fascia ora si sceglie in prenotazione, quindi di norma
          è già fissata da prima che il bucato sia pronto. Resta il caso in cui
          non c'era nessuno slot libero dopo la lavorazione: lì la programma
          l'ops, ed è il ramo qui sotto. Il form per sceglierla da questa
          schermata non torna: la decisione si prende una volta sola. */}
      {prontoDaConsegnare && (
        <section className="rounded-[18px] border border-line bg-white p-5">
          {consegnaFissata ? (
            <>
              <div className="font-display text-sm font-extrabold text-navy">Riconsegna programmata 🚚</div>
              <p className="mt-1 text-sm font-medium text-muted">Ti riportiamo il bucato:</p>
              <div className="mt-3 rounded-[14px] bg-ice p-3 font-display text-sm font-extrabold text-navy">
                {fmtFull(consegnaFissata.starts_at)}
              </div>
              <p className="mt-2 text-xs font-medium text-muted">
                Se a quell&apos;ora non ci sei, scrivici: spostiamo il passaggio.
              </p>
            </>
          ) : (
            <>
              <div className="font-display text-sm font-extrabold text-navy">I tuoi capi sono pronti 🎉</div>
              <p className="mt-1 text-sm font-medium text-muted">
                Alla riconsegna pensiamo noi: stiamo organizzando il giro e ti avvisiamo appena abbiamo giorno e ora.
              </p>
            </>
          )}
        </section>
      )}

      {/* Capi speciali addebitati. Sopra i capi e le segnalazioni: se sul
          ritiro c'è un costo in più, è la prima cosa che una persona vuole
          sapere aprendo la pagina. */}
      {extra.length > 0 && (
        <section className="rounded-[18px] border border-[#C9881F]/35 bg-[#C9881F]/[0.06] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-sm font-extrabold text-navy">Capi speciali su questo ritiro</span>
            <span className="font-display text-base font-black text-[#C9881F]">{eurCents(totaleExtraCents)}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-muted">
            Capi fuori dal sacco base, riconosciuti in lavanderia e conteggiati a listino.
          </p>
          <ul className="mt-3 space-y-1.5">
            {extra.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-white px-3 py-2">
                <span className="font-display text-sm font-bold text-navy">
                  {x.qty}× {x.item_name}
                </span>
                <span className="text-sm font-semibold text-navy">
                  {eurCents(x.price_cli_cents * x.qty)}
                  {x.charged_at ? "" : " · in attesa"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-medium text-muted">
            L&apos;importo finisce sulla tua prossima fattura mensile, non è un pagamento a parte. Se qualcosa
            non ti torna scrivici a info@washloop.it citando questo ritiro.
          </p>
        </section>
      )}

      {/* Segnalazioni della lavanderia. Sopra i capi e sopra tutto il resto:
          se c'è qualcosa che non va con la roba, è la prima cosa da leggere,
          non una nota in fondo alla pagina. */}
      {segnalazioni.length > 0 && (
        <section className="rounded-[18px] border border-line bg-white p-5">
          <div className="font-display text-sm font-extrabold text-navy">
            Dalla lavanderia ({segnalazioni.length})
          </div>
          <p className="mt-1 text-xs font-medium text-muted">
            Chi ha aperto il tuo sacco ha trovato qualcosa che devi sapere.
          </p>
          <div className="mt-4 space-y-3">
            {segnalazioni.map((s) => (
              <SegnalazioneRiga key={s.id} s={s} fotoUrl={s.fotoUrl} perCliente />
            ))}
          </div>
          <p className="mt-3 text-xs font-medium text-muted">
            Non ti sembra giusto? Scrivici a info@washloop.it citando questo ritiro: guardiamo insieme.
          </p>
        </section>
      )}

      {/* Capi */}
      {itemsFirmati.length > 0 && (
        <section className="rounded-[18px] border border-line bg-white p-5">
          <div className="font-display text-sm font-extrabold text-navy">I tuoi capi ({itemsFirmati.length})</div>
          <p className="mt-1 text-xs font-medium text-muted">Ogni capo è tracciato singolarmente.</p>
          <div className="mt-4 space-y-2">
            {itemsFirmati.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-[14px] border border-line bg-ice px-3 py-2.5">
                {it.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.photo_url} alt="" className="h-10 w-10 rounded-[8px] object-cover" />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-white">👕</div>
                )}
                <div className="flex-1 text-sm font-semibold text-navy">{it.kind ?? "Capo"}</div>
                <span className={`rounded-full px-2.5 py-1 font-display text-xs font-bold ${itemTone[it.status]}`}>{ITEM_STATUS_LABEL[it.status]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Aiuto: l'assistente è il badge fisso in basso a destra, qui resta
          l'email per il caso specifico — che l'assistente non può risolvere
          perché non vede gli ordini. */}
      <a
        href="mailto:info@washloop.it"
        className="flex w-full items-center justify-center gap-2 rounded-full bg-ice py-3.5 font-display text-sm font-extrabold text-blue"
      >
        Serve aiuto? Scrivici
      </a>
    </div>
  );
}
