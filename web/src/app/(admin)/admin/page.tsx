import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { StatTile } from "@/components/admin/StatTile";
import { CustomersPanel } from "@/components/admin/CustomersPanel";
import { createServiceClient } from "@/lib/supabase/server";
import { daContattare } from "@/lib/persone";
import { incassiMensili } from "@/lib/incassi-mensili";
import { GraficoIncassi } from "@/components/admin/GraficoIncassi";
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

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ prova?: string }> }) {
  const { prova } = await searchParams;
  const includiProva = prova === "1";
  const svc = createServiceClient();
  const oraIso = new Date().toISOString();

  // Stati in cui un ordine è ancora "in circolo": oltre questi non c'è più
  // niente da sbloccare.
  const ATTIVI = ["requested", "pickup_scheduled", "picked_up", "at_laundry", "washing", "ready", "delivery_scheduled", "out_for_delivery", "delivery_failed"];

  // Ordini che riguardano clienti veri. `!inner` sull'embed è indispensabile:
  // senza, il filtro varrebbe solo sull'embed e gli ordini di prova di Mario
  // Test resterebbero nei riquadri "in ritardo" e "senza rider" per sempre.
  const ordiniVeri = () => {
    const q = svc.from("orders").select("id, profiles!orders_customer_id_fkey!inner(is_test)", { count: "exact", head: true }).in("status", ATTIVI);
    return includiProva ? q : q.eq("profiles.is_test", false);
  };
  const abbonamentiVeri = () => {
    const q = svc.from("subscriptions").select("id, profiles!inner(is_test)", { count: "exact", head: true }).in("status", ["past_due", "unpaid"]);
    return includiProva ? q : q.eq("profiles.is_test", false);
  };

  // Segnalazioni della lavanderia ancora aperte. Stesso `!inner` degli ordini:
  // senza, quelle sui profili di prova resterebbero nel conteggio per sempre.
  const segnalazioniAperte = () => {
    const q = svc
      .from("order_issues")
      .select("id, orders!inner(profiles!orders_customer_id_fkey!inner(is_test))", { count: "exact", head: true })
      .is("resolved_at", null);
    return includiProva ? q : q.eq("orders.profiles.is_test", false);
  };

  const [daRichiamare, inRitardo, senzaRider, pagamentiKo, segnalazioni, rev, laundry, subs, customers, mesiIncassi] = await Promise.all([
    // Non una query sui soli `leads`: quella contava anche chi nel frattempo è
    // diventato cliente. `daContattare` passa dalla stessa deduplica di Persone,
    // così il numero e la pagina che apre dicono la stessa cosa.
    daContattare(includiProva),
    // Ritardo = doveva essere pronto e non lo è ancora. Stessa regola del board
    // ordini (`isLate`), qui applicata dal database invece che nel browser.
    ordiniVeri().lt("eta_ready_at", oraIso),
    ordiniVeri().is("courier_id", null),
    abbonamentiVeri(),
    segnalazioniAperte(),
    revenueMetrics(includiProva),
    laundryMetrics(includiProva),
    subscriberMetrics(includiProva),
    customersList(includiProva),
    incassiMensili(includiProva),
  ]);

  const blocchi: Blocco[] = [
    {
      // Primo riquadro perché è l'unica voce che riguarda la roba delle persone
      // e non un numero: un capo rovinato non aspetta il turno.
      label: "Segnalazioni capi",
      n: segnalazioni.count ?? 0,
      sub: "dalla lavanderia, da gestire",
      href: "/admin/segnalazioni",
      tono: "text-[#C0392B]",
    },
    {
      label: "Da contattare",
      n: daRichiamare.length,
      sub: "contatti senza risposta",
      href: "/admin/persone?stadio=lead&contatto=da_contattare",
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
      // Portava all'elenco completo degli abbonati, senza filtro: il numero
      // diceva 1 e la pagina ne mostrava dieci. Stesso difetto dei ritiri in
      // ritardo e dei contatti da richiamare.
      href: "/admin/persone?stadio=difficolta",
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

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      {/* Soldi. Il numero grande è quello incassato davvero: il ricorrente è
          una previsione e sta accanto, più piccolo. */}
      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-extrabold text-navy">Soldi del mese</h2>
          <Link
            href={includiProva ? "/admin" : "/admin?prova=1"}
            className="font-display text-xs font-bold text-navy/55 hover:text-navy"
          >
            {includiProva ? "Nascondi dati di prova" : "Mostra dati di prova"}
          </Link>
        </div>

        <Link href={`/admin/numeri/incassato-mese${includiProva ? "?prova=1" : ""}`} className="block rounded-[18px] border border-line bg-ice/50 p-5 transition-colors hover:border-navy/25">
          <div className="font-display text-[38px] font-black leading-none text-[#1F8A5B]">{eurCents(rev.incassatoMeseCents)}</div>
          <div className="mt-1.5 font-display text-sm font-extrabold text-navy">Incassato questo mese →</div>
          <div className="text-xs font-medium text-muted">Soldi realmente arrivati su Stripe · {eurCents(rev.incassatoAnnoCents)} da inizio anno</div>
        </Link>

        <GraficoIncassi mesi={mesiIncassi} prova={includiProva} />

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <NumeroCliccabile href={`/admin/numeri/ricorrente${includiProva ? "?prova=1" : ""}`} label="Ricorrente atteso" value={eurCents(rev.coreMrrCents)} sub="Abbonamenti attivi oggi" />
          <NumeroCliccabile href={`/admin/numeri/extra-mese${includiProva ? "?prova=1" : ""}`} label="Extra del mese" value={eurCents(rev.extraMonthCents)} sub="Capi fuori abbonamento e addebiti" />
          <NumeroCliccabile href={`/admin/numeri/ricorrente${includiProva ? "?prova=1" : ""}`} label="Proiezione anno" value={eurCents(rev.coreYearProjCents)} sub="Ricorrente × 12" />
        </div>

        <p className="mt-2 text-[11px] font-medium text-muted">
          Ogni numero si apre e mostra le righe che lo compongono. Incassato e Extra sono IVA inclusa; il costo lavanderia qui sotto è IVA esclusa.
        </p>
      </Card>

      {/* Lavanderia */}
      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-extrabold text-navy">Lavanderia</h2>
          <Link href="/admin/lavanderia" className="font-display text-xs font-bold text-blue hover:underline">Vedi il dettaglio →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <NumeroCliccabile href={`/admin/numeri/sacchi-mese${includiProva ? "?prova=1" : ""}`} label="Sacchi · mese" value={String(laundry.bagsMonth)} sub="Ritirati questo mese" />
          <StatTile label="Sacchi · anno" value={String(laundry.bagsYear)} sub="Da inizio anno" />
          <NumeroCliccabile href={`/admin/numeri/da-dare${includiProva ? "?prova=1" : ""}`} label="Da dare · mese" value={eurCents(laundry.laundryOwedMonthCents)} sub="Dal registro compensi (IVA escl.)" />
          <StatTile label="Da dare · anno" value={eurCents(laundry.laundryOwedYearCents)} sub="Totale maturato" tone="text-[#C9881F]" />
        </div>
      </Card>

      {/* Abbonati */}
      <Card className="mb-6">
        <h2 className="mb-3 font-display text-base font-extrabold text-navy">Abbonati</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <NumeroCliccabile href={`/admin/numeri/nuovi-abbonati${includiProva ? "?prova=1" : ""}`} label="Nuovi · mese" value={String(subs.newSubsMonth)} sub={`${subs.newSubsYear} nell'anno`} />
          <NumeroCliccabile href={`/admin/numeri/interrotti${includiProva ? "?prova=1" : ""}`} label="Interrotti · mese" value={String(subs.canceledMonth)} sub={`${subs.canceledYear} nell'anno`} />
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

/** Riquadro con un numero che si può aprire per vedere da cosa è composto. */
function NumeroCliccabile({ href, label, value, sub }: { href: string; label: string; value: string; sub: string }) {
  return (
    <Link href={href} className="rounded-[18px] border border-line bg-white p-4 transition-colors hover:border-navy/30">
      <div className="font-display text-xl font-black text-navy">{value}</div>
      <div className="mt-0.5 font-display text-xs font-extrabold text-navy">{label} →</div>
      <div className="text-[11px] font-medium text-muted">{sub}</div>
    </Link>
  );
}
