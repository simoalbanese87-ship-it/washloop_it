import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/Button";
import { AddSpecialForm, type ListItem } from "@/components/app/AddSpecialForm";
import { SegnalazioneForm } from "@/components/app/SegnalazioneForm";
import { SegnalazioneRiga, type Segnalazione } from "@/components/app/SegnalazioneRiga";
import { createClient } from "@/lib/supabase/server";
import { advanceStatus, removeSpecial } from "@/lib/actions/partner";
import { LAVORAZIONE_APERTA, signedProofUrl, type OrderStatus } from "@/lib/orders";
import { SEGNALABILE } from "@/lib/segnalazioni";
import { fmtFull } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PartnerOrder = {
  order_id: string;
  client_code: string | null;
  bags: number;
  service: string | null;
  fragrance: string | null;
  status: OrderStatus;
  eta_ready_at: string | null;
  created_at: string;
};

type Special = {
  id: string;
  item_name: string;
  qty: number;
  comp_lav_cents: number;
  charged_at: string | null;
};

const NEXT_CTA: Partial<Record<OrderStatus, string>> = {
  picked_up: "Segna arrivato in lavanderia",
  at_laundry: "Avvia lavaggio",
  washing: "Segna pronto per la riconsegna",
};

function eur(c: number) {
  return (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export default async function LaundryOrderDetail({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: specials }, { data: listino }, { data: issues }] = await Promise.all([
    supabase
      .from("partner_orders")
      .select("order_id, client_code, bags, service, fragrance, status, eta_ready_at, created_at")
      .eq("order_id", orderId)
      .maybeSingle<PartnerOrder>(),
    supabase
      .from("partner_order_specials")
      .select("id, item_name, qty, comp_lav_cents, charged_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .returns<Special[]>(),
    supabase
      .from("partner_special_items")
      .select("id, category_id, category_name, category_emoji, name, comp_lav_cents")
      .order("category_sort", { ascending: true })
      .order("sort", { ascending: true })
      .returns<ListItem[]>(),
    supabase
      .from("order_issues")
      .select("id, kind, capo, testo, photo_url, created_at, published_at, resolved_at, resolution")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .returns<Segnalazione[]>(),
  ]);

  if (!order) notFound();

  const cta = NEXT_CTA[order.status];
  // Stessa regola applicata dalla server action `addSpecial`: qui nasconde il
  // modulo, lì rifiuta la richiesta.
  const lavorazioneChiusa = !LAVORAZIONE_APERTA.includes(order.status);
  const items = specials ?? [];
  const totComp = items.reduce((s, i) => s + i.comp_lav_cents * i.qty, 0);

  // Il bucket delle foto è privato: le URL si firmano qui, lato server. Si usa
  // il service client di proposito — chi guarda ha già superato il controllo
  // sull'ordine due righe più su, e la firma non deve dipendere dai permessi
  // di lettura dello storage.
  const svc = createServiceClient();
  const segnalazioni = await Promise.all(
    (issues ?? []).map(async (s) => ({ ...s, fotoUrl: await signedProofUrl(svc, s.photo_url) })),
  );
  const puoSegnalare = SEGNALABILE.includes(order.status);

  return (
    <>
      <Link href="/laundry" className="font-display text-sm font-bold text-navy/55 hover:text-navy">
        ← Lavorazioni
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <PageTitle kicker="Ordine" title={order.client_code ?? "—"} />
        <StatusBadge status={order.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Dati operativi (anonimi) */}
        <Card>
          <h2 className="font-display text-lg font-extrabold text-navy">Lavorazione</h2>
          <dl className="mt-3 space-y-2 text-sm font-medium text-muted">
            <div className="flex justify-between"><dt>Sacchi</dt><dd className="font-bold text-navy">{order.bags}</dd></div>
            {order.service && <div className="flex justify-between"><dt>Servizio</dt><dd className="font-bold text-navy">{order.service}</dd></div>}
            {order.fragrance && <div className="flex justify-between"><dt>Profumo</dt><dd className="font-bold text-navy">{order.fragrance}</dd></div>}
            {order.eta_ready_at && <div className="flex justify-between"><dt>Pronto entro</dt><dd className="font-bold text-navy">{fmtFull(order.eta_ready_at)}</dd></div>}
          </dl>

          {cta && (
            <form action={advanceStatus} className="mt-5">
              <input type="hidden" name="order_id" value={order.order_id} />
              <Button type="submit" className="w-full">{cta}</Button>
            </form>
          )}

          <p className="mt-4 text-xs font-medium text-muted">
            Per tutela privacy non vedi nome, indirizzo o note del cliente: solo il codice anonimo e i dati di lavorazione.
          </p>
        </Card>

        {/* Capi speciali. Quando la lavorazione è chiusa il modulo sparisce:
            i capi si aggiungono mentre il sacco è aperto sul banco, non dopo.
            Restano visibili quelli già inseriti, per controllo e compenso. */}
        <Card>
          <h2 className="font-display text-lg font-extrabold text-navy">Capi speciali (sacco separato)</h2>
          {lavorazioneChiusa ? (
            <p className="mt-1 text-sm font-medium text-muted">
              Lavorazione conclusa: non si aggiungono altri capi. Se manca qualcosa, scrivi a ops.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm font-medium text-muted">Aggiungi i capi fuori listino base ricevuti: l&apos;addebito al cliente è automatico.</p>
              {/* La regola delle camicie non era scritta da nessuna parte lato
                  lavanderia: chi apre il sacco non poteva sapere quante fossero
                  incluse, quindi o le contava tutte o non ne contava nessuna.
                  Va detta qui, davanti al modulo con cui si contano. */}
              <p className="mt-2 rounded-[12px] bg-[#C9881F]/10 px-3 py-2 text-sm font-semibold text-[#C9881F]">
                Camicie: le prime <strong>3 per sacco</strong> sono comprese nell&apos;abbonamento e non si aggiungono.
                Conta solo quelle in più — dalla quarta in poi, una riga per ciascuna.
              </p>
              <div className="mt-4">
                <AddSpecialForm orderId={order.order_id} items={listino ?? []} />
              </div>
            </>
          )}

          <div className="mt-6 space-y-2">
            {items.length > 0 ? (
              items.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-ice px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-display text-sm font-bold text-navy">
                      {s.qty}× {s.item_name}
                    </div>
                    <div className="text-xs font-medium text-muted">
                      {eur(s.comp_lav_cents)} cad. · {s.charged_at ? "addebitato" : "in attesa"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-sm font-extrabold text-navy">{eur(s.comp_lav_cents * s.qty)}</span>
                    {!s.charged_at && (
                      <form action={removeSpecial}>
                        <input type="hidden" name="order_id" value={order.order_id} />
                        <input type="hidden" name="special_id" value={s.id} />
                        <button type="submit" aria-label="Rimuovi" className="font-display text-sm font-bold text-[#C0392B]/70 hover:text-[#C0392B]">
                          Rimuovi
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm font-medium text-muted">Nessun capo speciale aggiunto.</p>
            )}
          </div>

          {items.length > 0 && (
            <div className="mt-4 flex justify-between border-t border-line pt-3 font-display font-extrabold text-navy">
              <span>Totale compenso</span>
              <span>{eur(totComp)}</span>
            </div>
          )}
        </Card>
      </div>

      {/* Segnalazioni: capi macchiati, rovinati, o rovinati da noi.
          Sta sotto e a tutta larghezza perché non è una cosa che si fa a ogni
          ordine — ma quando serve serve tutto lo spazio, e non deve essere
          nascosta dentro un menu. */}
      <Card className="mt-6">
        <h2 className="font-display text-lg font-extrabold text-navy">Segnalazioni sui capi</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Un capo arrivato già macchiato o strappato, una macchia che non è venuta via, o un capo rovinato in
          lavorazione. Non è un addebito: per i capi in più c&apos;è il riquadro qui sopra.
        </p>

        {segnalazioni.length > 0 && (
          <div className="mt-4 space-y-3">
            {segnalazioni.map((s) => (
              <SegnalazioneRiga key={s.id} s={s} fotoUrl={s.fotoUrl} />
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-line pt-5">
          {puoSegnalare ? (
            <SegnalazioneForm orderId={order.order_id} />
          ) : (
            <p className="text-sm font-medium text-muted">
              Questo ordine non è più in lavorazione da voi: per segnalare qualcosa scrivete a ops.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
