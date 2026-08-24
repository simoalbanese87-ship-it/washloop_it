import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { startCheckout, openPortal } from "@/lib/actions/billing";
import { fmtDate } from "@/lib/format";
import { planRecap } from "@/lib/plan-copy";
import { linkPagamento } from "@/lib/dunning-piano";
import { CostsExplainer } from "@/components/app/CostsExplainer";
import { DatiFatturaForm } from "@/components/app/DatiFatturaForm";

type Plan = { id: string; code: string; name: string; price_month_cents: number; pickups_per_week: number; turnaround_hours: number };
type Sub = { status: string; current_period_end: string | null; plan_id: string | null; last_failed_invoice_url: string | null; plans: { name: string } | null };

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT");

const STATUS_LABEL: Record<string, string> = {
  active: "Attivo",
  trialing: "In prova",
  past_due: "Pagamento in sospeso",
  unpaid: "Non pagato",
  canceled: "Disdetto",
  paused: "In pausa",
  incomplete: "Da completare",
};

export default async function AbbonamentoPage({ searchParams }: { searchParams: Promise<{ need?: string }> }) {
  const supabase = await createClient();
  const now = new Date();
  const monthStartIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [{ need }, { data: plans }, { data: sub }, { data: monthOrders }, { data: monthSpecials }] = await Promise.all([
    searchParams,
    supabase.from("plans").select("id, code, name, price_month_cents, pickups_per_week, turnaround_hours").eq("active", true).order("sort").returns<Plan[]>(),
    supabase.from("subscriptions").select("status, current_period_end, plan_id, last_failed_invoice_url, plans(name)").order("created_at", { ascending: false }).limit(1).maybeSingle<Sub>(),
    supabase.from("orders").select("bags, status, created_at").gte("created_at", monthStartIso).neq("status", "cancelled").returns<{ bags: number; status: string; created_at: string }[]>(),
    supabase.from("order_specials").select("price_cli_cents, created_at").gte("created_at", monthStartIso).returns<{ price_cli_cents: number; created_at: string }[]>(),
  ]);

  const active = sub?.status === "active" || sub?.status === "trialing";
  // Fattura rimasta aperta. Finora tutto quello che serve a chi si trova qui —
  // lo stato del piano, il portale Stripe, il link per pagare — stava dentro
  // rami `active &&`, cioè irraggiungibile proprio a lui: vedeva il listino
  // piani come un nuovo iscritto, e l'unico bottone apriva un SECONDO
  // abbonamento invece di saldare il primo.
  const sofferenza = sub?.status === "past_due" || sub?.status === "unpaid";
  const payUrl = linkPagamento(sub?.last_failed_invoice_url);

  // Dati di fatturazione: li chiediamo solo a chi vuole la fattura. Di norma
  // basta la ricevuta, che parte già via email a ogni addebito.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: fatt } = user
    ? await supabase
        .from("profiles")
        .select("billing_wants_invoice, billing_name, billing_address, billing_cap, billing_city, billing_tax_code, billing_vat, billing_sdi, billing_pec")
        .eq("id", user.id)
        .maybeSingle<{
          billing_wants_invoice: boolean; billing_name: string | null; billing_address: string | null;
          billing_cap: string | null; billing_city: string | null; billing_tax_code: string | null;
          billing_vat: string | null; billing_sdi: string | null; billing_pec: string | null;
        }>()
    : { data: null };

  // Uso del mese (dati reali)
  const ordersCount = monthOrders?.length ?? 0;
  const bagsCount = (monthOrders ?? []).reduce((s, o) => s + (o.bags ?? 0), 0);
  const extraCents = (monthSpecials ?? []).reduce((s, x) => s + (x.price_cli_cents ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Abbonamento</div>
        <h1 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">Il tuo piano</h1>
        <p className="mt-1.5 text-sm font-medium text-muted">Cambia, metti in pausa o disdici quando vuoi.</p>
      </div>

      {need && !active && !sofferenza && (
        <div className="rounded-[18px] border border-blue/30 bg-blue/5 p-4 text-sm font-semibold text-navy">
          Per prenotare un ritiro serve un abbonamento attivo. Scegli un piano qui sotto.
        </div>
      )}

      {/* Pagamento da recuperare: prima di tutto il resto, e con il link che
          salda davvero la fattura invece di aprirne un'altra. */}
      {sofferenza && (
        <section className="rounded-[22px] border border-[#C0392B]/30 bg-[#C0392B]/5 p-5">
          <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#C0392B]">
            {sub?.status === "unpaid" ? "Abbonamento sospeso" : "Pagamento in sospeso"}
          </div>
          <h2 className="mt-1.5 font-display text-[22px] font-black leading-tight text-navy">
            {sub?.plans?.name ? `Piano ${sub.plans.name}` : "Il tuo piano"} · {STATUS_LABEL[sub?.status ?? ""] ?? sub?.status}
          </h2>
          <p className="mt-2 text-sm font-medium text-muted">
            L&apos;ultimo addebito non è andato a buon fine. Fino al saldo non puoi prenotare nuovi ritiri; quelli già fissati li
            facciamo comunque. Di solito è una carta scaduta: si sistema in un minuto.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a href={payUrl} className="inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-6 py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
              {sub?.last_failed_invoice_url ? "Paga la fattura →" : "Aggiorna il pagamento →"}
            </a>
            <form action={openPortal}>
              <button type="submit" className="font-display text-sm font-bold text-blue hover:underline">
                Cambia metodo di pagamento
              </button>
            </form>
          </div>
          <p className="mt-3 text-xs font-medium text-muted">
            Hai già pagato? Possono volerci alcune ore: se dopo domani vedi ancora questo avviso, scrivici a {" "}
            <a href="mailto:info@washloop.it" className="font-bold text-blue hover:underline">info@washloop.it</a>.
          </p>
        </section>
      )}

      {/* Piano attivo */}
      {active && (
        <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#26417a] to-[#16264f] p-6 text-white shadow-[0_18px_44px_-26px_rgba(27,45,94,0.7)]">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-cyan/20 blur-2xl" />
          <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.14em] text-cyan">Piano attivo</div>
          <div className="mt-1 font-display text-[24px] font-black leading-tight">{sub?.plans?.name ?? "Attivo"}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-white/65">
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-display text-xs font-bold text-cyan">{STATUS_LABEL[sub?.status ?? ""] ?? sub?.status}</span>
            {sub?.current_period_end && <span>Rinnovo il {fmtDate(sub.current_period_end)}</span>}
          </div>
          <form action={openPortal} className="mt-4">
            <button type="submit" className="inline-flex rounded-full bg-white/15 px-4 py-2 font-display text-sm font-extrabold text-white backdrop-blur transition-colors hover:bg-white/25">
              Gestisci abbonamento →
            </button>
          </form>
        </section>
      )}

      {/* Uso del mese */}
      {active && (
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-display text-base font-extrabold text-navy">Uso del mese</h2>
            <Link href="/app/fatture" className="font-display text-sm font-bold text-blue">Vedi le fatture →</Link>
          </div>
          <div className="flex gap-3">
            <StatTile n={String(bagsCount)} label={bagsCount === 1 ? "Sacco ritirato" : "Sacchi ritirati"} />
            <StatTile n={`€${(extraCents / 100).toLocaleString("it-IT", { minimumFractionDigits: 0 })}`} label="Extra del mese" />
            <StatTile n={String(ordersCount)} label={ordersCount === 1 ? "Ordine" : "Ordini"} />
          </div>
        </section>
      )}

      {/* Piani */}
      <div className="space-y-3">
        {(plans ?? []).map((p) => {
          // In sofferenza il piano resta il suo: l'abbonamento esiste, è la
          // fattura a non essere stata pagata.
          const isCurrent = (active || sofferenza) && sub?.plan_id === p.id;
          return (
            <section key={p.id} className={`rounded-[22px] border bg-white p-5 ${isCurrent ? "border-cyan shadow-[0_18px_40px_-20px_rgba(0,200,240,0.45)]" : "border-line"}`}>
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-black text-navy">{p.name}</div>
                {isCurrent && <span className="rounded-full bg-cyan/15 px-2.5 py-0.5 font-display text-xs font-extrabold text-blue">Attuale</span>}
              </div>
              <div className="mt-2 flex items-end gap-1">
                <span className="font-display text-[34px] font-black tracking-[-0.03em] text-navy">€{euro(p.price_month_cents)}</span>
                <span className="mb-1.5 text-sm font-semibold text-muted">/mese</span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-muted">
                {planRecap(p.code) ?? `Ritiro 1 volta a settimana · pronto in ${p.turnaround_hours}h · ritiro e consegna inclusi`}
              </p>
              {isCurrent && sofferenza ? (
                <a href={payUrl} className="mt-4 block rounded-full bg-gradient-to-br from-blue to-cyan py-3 text-center font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
                  Piano attuale · salda per riattivarlo
                </a>
              ) : isCurrent ? (
                <div className="mt-4 rounded-full border-2 border-line py-3 text-center font-display text-sm font-extrabold text-muted">Piano attuale</div>
              ) : sofferenza ? (
                /* Senza questo ramo il bottone qui sotto era «Attiva {piano} →»
                   con `startCheckout`: apriva un SECONDO abbonamento accanto a
                   quello non pagato, addebitando due canoni allo stesso
                   cliente. Prima si salda, poi semmai si cambia piano. */
                <div className="mt-4 rounded-full border-2 border-line py-3 text-center font-display text-sm font-extrabold text-muted">
                  Salda prima la fattura aperta
                </div>
              ) : active ? (
                <form action={openPortal} className="mt-4">
                  <button type="submit" className="w-full rounded-full border-2 border-line py-3 font-display text-sm font-extrabold text-navy">Passa a {p.name} →</button>
                </form>
              ) : (
                <form action={startCheckout} className="mt-4">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <button type="submit" className="w-full rounded-full bg-gradient-to-br from-blue to-cyan py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">Attiva {p.name} →</button>
                </form>
              )}
            </section>
          );
        })}
        {(!plans || plans.length === 0) && (
          <div className="rounded-[18px] border border-line bg-white p-5 text-sm font-medium text-muted">Piani non ancora disponibili.</div>
        )}
      </div>

      {/* Costi fissi vs extra */}
      <CostsExplainer />

      {/* Recesso/disdetta — discreto. Porta al Customer Portal Stripe. */}
      {active && (
        <div className="border-t border-line pt-5 text-center">
          <form action={openPortal}>
            <button type="submit" className="text-xs font-semibold text-muted underline-offset-2 hover:text-navy hover:underline">
              Recedi dal contratto / disdici l&apos;abbonamento
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-muted/80">
            La disdetta ferma il rinnovo automatico a fine periodo. Il periodo già pagato non è rimborsabile una volta avviato il servizio.
          </p>
        </div>
      )}

      {/* Ricevuta o fattura */}
      <section className="rounded-[18px] border border-line bg-white p-5">
        <h2 className="font-display text-base font-extrabold text-navy">Ricevuta e fattura</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          A ogni pagamento ti mandiamo la ricevuta via email. Se ti serve la fattura, dicci come intestarla.
        </p>
        <div className="mt-4">
          <DatiFatturaForm
            iniziale={{
              vuole: fatt?.billing_wants_invoice ?? false,
              nome: fatt?.billing_name ?? null,
              indirizzo: fatt?.billing_address ?? null,
              cap: fatt?.billing_cap ?? null,
              citta: fatt?.billing_city ?? null,
              codiceFiscale: fatt?.billing_tax_code ?? null,
              partitaIva: fatt?.billing_vat ?? null,
              sdi: fatt?.billing_sdi ?? null,
              pec: fatt?.billing_pec ?? null,
            }}
          />
        </div>
      </section>
    </div>
  );
}

function StatTile({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex-1 rounded-[18px] border border-line bg-white p-4">
      <div className="font-display text-2xl font-black tracking-[-0.02em] text-navy">{n}</div>
      <div className="mt-0.5 text-[11px] font-bold text-muted">{label}</div>
    </div>
  );
}
