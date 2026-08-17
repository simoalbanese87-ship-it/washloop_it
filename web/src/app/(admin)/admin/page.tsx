import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { StatTile } from "@/components/admin/StatTile";
import { CustomersPanel } from "@/components/admin/CustomersPanel";
import { createServiceClient } from "@/lib/supabase/server";
import { revenueMetrics, laundryMetrics, subscriberMetrics, customersList } from "@/lib/admin-metrics";
import { sendDigestNow } from "@/lib/actions/digest";
import { eurCents } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Home: cosa richiede un intervento oggi, e solo dopo i numeri.
 *
 *  Prima questa pagina era una panoramica lunga che ripeteva l'elenco dei lead
 *  già presente in altre tre pagine. I lead ora vivono in /admin/contatti: qui
 *  resta il conteggio di quelli fermi, insieme alle altre tre cose che possono
 *  bloccare il servizio. Ogni riquadro apre la lista già filtrata, così il
 *  numero non è mai un vicolo cieco. */

type Blocco = { label: string; n: number; sub: string; href: string; tono: string };

export default async function AdminHome() {
  const svc = createServiceClient();
  const oraIso = new Date().toISOString();

  // Stati in cui un ordine è ancora "in circolo": oltre questi non c'è più
  // niente da sbloccare.
  const ATTIVI = ["requested", "pickup_scheduled", "picked_up", "at_laundry", "washing", "ready", "delivery_scheduled", "out_for_delivery", "delivery_failed"];

  const [daContattare, inRitardo, senzaRider, pagamentiKo, rev, laundry, subs, customers] = await Promise.all([
    svc.from("leads").select("id", { count: "exact", head: true }).eq("contact_status", "da_contattare"),
    // Ritardo = doveva essere pronto e non lo è ancora. Stessa regola del board
    // ordini (`isLate`), qui applicata dal database invece che nel browser.
    svc.from("orders").select("id", { count: "exact", head: true }).lt("eta_ready_at", oraIso).in("status", ATTIVI),
    svc.from("orders").select("id", { count: "exact", head: true }).is("courier_id", null).in("status", ATTIVI),
    svc.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["past_due", "unpaid"]),
    revenueMetrics(),
    laundryMetrics(),
    subscriberMetrics(),
    customersList(),
  ]);

  const blocchi: Blocco[] = [
    {
      label: "Da contattare",
      n: daContattare.count ?? 0,
      sub: "contatti senza risposta",
      href: "/admin/contatti?stato=da_contattare",
      tono: "text-[#C9881F]",
    },
    {
      label: "Ordini in ritardo",
      n: inRitardo.count ?? 0,
      sub: "oltre l'ora prevista di pronto",
      href: "/admin/ordini?filtro=ritardo",
      tono: "text-[#C0392B]",
    },
    {
      label: "Senza rider",
      n: senzaRider.count ?? 0,
      sub: "ordini attivi non assegnati",
      href: "/admin/ordini?filtro=da_assegnare",
      tono: "text-[#C0392B]",
    },
    {
      label: "Pagamenti falliti",
      n: pagamentiKo.count ?? 0,
      sub: "abbonamenti da recuperare",
      href: "/admin/abbonati",
      tono: "text-[#C9881F]",
    },
  ];

  const daFare = blocchi.reduce((t, b) => t + b.n, 0);

  return (
    <>
      <PageTitle
        kicker="Home"
        title={daFare === 0 ? "Tutto in ordine" : "Da sistemare oggi"}
        sub={daFare === 0 ? "Nessuna cosa aperta: sotto trovi i numeri del mese." : `${daFare} cose richiedono un intervento.`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {blocchi.map((b) => (
          <Link
            key={b.label}
            href={b.href}
            className={`rounded-[18px] border bg-white p-5 transition-colors ${b.n > 0 ? "border-navy/20 hover:border-navy/40" : "border-line"}`}
          >
            <div className={`font-display text-[32px] font-black leading-none ${b.n > 0 ? b.tono : "text-navy/25"}`}>{b.n}</div>
            <div className="mt-1.5 font-display text-sm font-extrabold text-navy">{b.label}</div>
            <div className="text-xs font-medium text-muted">{b.sub}</div>
          </Link>
        ))}
      </div>

      {/* Ricavi */}
      <Card className="mb-6">
        <h2 className="mb-3 font-display text-base font-extrabold text-navy">Ricavi</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Core · mese (MRR)" value={eurCents(rev.coreMrrCents)} sub="Abbonamenti attivi × prezzo" tone="text-[#1F8A5B]" />
          <StatTile label="Extra · mese" value={eurCents(rev.extraMonthCents)} sub="Capi extra + addebiti" tone="text-blue" />
          <StatTile label="Core · anno (proiez.)" value={eurCents(rev.coreYearProjCents)} sub="MRR × 12" />
          <StatTile label="Extra · anno" value={eurCents(rev.extraYearCents)} sub="Da inizio anno" />
        </div>
        <p className="mt-2 text-[11px] font-medium text-muted">Core = ricavo ricorrente atteso da DB (include gli abbonamenti manuali). Extra esatti da data di creazione. IVA: Core/Extra IVA inclusa; il costo lavanderia sotto è IVA esclusa.</p>
      </Card>

      {/* Lavanderia */}
      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-extrabold text-navy">Lavanderia</h2>
          <Link href="/admin/lavanderia" className="font-display text-xs font-bold text-blue hover:underline">Vedi il dettaglio →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Sacchi · mese" value={String(laundry.bagsMonth)} sub="Ritirati questo mese" />
          <StatTile label="Sacchi · anno" value={String(laundry.bagsYear)} sub="Da inizio anno" />
          <StatTile label="Da dare · mese" value={eurCents(laundry.laundryOwedMonthCents)} sub="Sacchi + extra (IVA escl.)" tone="text-[#C9881F]" />
          <StatTile label="Da dare · anno" value={eurCents(laundry.laundryOwedYearCents)} sub="Totale maturato" tone="text-[#C9881F]" />
        </div>
      </Card>

      {/* Abbonati */}
      <Card className="mb-6">
        <h2 className="mb-3 font-display text-base font-extrabold text-navy">Abbonati</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Nuovi · mese" value={String(subs.newSubsMonth)} sub={`${subs.newSubsYear} nell'anno`} tone="text-[#1F8A5B]" />
          <StatTile label="Interrotti · mese" value={String(subs.canceledMonth)} sub={`${subs.canceledYear} nell'anno`} tone="text-[#C0392B]" />
          <StatTile label="Attivi ora" value={String(subs.currentActive)} />
          <StatTile label="Disdetti ora" value={String(subs.currentCanceled)} />
          <StatTile label="In pausa ora" value={String(subs.currentPaused)} />
        </div>
      </Card>

      {/* Clienti attivi */}
      <Card className="mb-6">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-extrabold text-navy">Clienti ({customers.length})</h2>
          <Link href="/admin/contatti" className="font-display text-xs font-bold text-blue hover:underline">Tutti i contatti →</Link>
        </div>
        <p className="mb-4 text-xs font-medium text-muted">Abbonati con abbonamento attivo. I potenziali clienti stanno in Contatti.</p>
        <CustomersPanel customers={customers} />
      </Card>

      {/* Il riepilogo che prima stava in "Novità" */}
      <Card>
        <h2 className="font-display text-base font-extrabold text-navy">Riepilogo agli admin</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Parte da solo ogni mattina alle 6:30 con le novità delle ultime 24 ore. Da qui lo mandi subito.
        </p>
        <form action={sendDigestNow} className="mt-3">
          <button type="submit" className="rounded-full border-2 border-navy/25 px-5 py-2 font-display text-sm font-extrabold text-navy hover:bg-navy/5">
            Invia ora il riepilogo
          </button>
        </form>
      </Card>
    </>
  );
}
