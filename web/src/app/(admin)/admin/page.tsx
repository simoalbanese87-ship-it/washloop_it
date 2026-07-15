import { Card, PageTitle } from "@/components/app/AppShell";
import { StatTile } from "@/components/admin/StatTile";
import { LeadsPanel } from "@/components/admin/LeadsPanel";
import { CustomersPanel } from "@/components/admin/CustomersPanel";
import { revenueMetrics, laundryMetrics, subscriberMetrics, leadsByStatusSource, customersList } from "@/lib/admin-metrics";
import { eurCents } from "@/lib/format";

export default async function AdminDashboard() {
  const [rev, laundry, subs, leadsRes, customers] = await Promise.all([
    revenueMetrics(),
    laundryMetrics(),
    subscriberMetrics(),
    leadsByStatusSource(),
    customersList(),
  ]);

  return (
    <>
      <PageTitle kicker="Dashboard" title="Panoramica" sub="Ricavi, abbonati, lavanderia e lead — mese e anno correnti." />

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
        <h2 className="mb-3 font-display text-base font-extrabold text-navy">Lavanderia</h2>
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

      {/* Clienti (abbonati attivi) */}
      <Card className="mb-6">
        <h2 className="mb-1 font-display text-base font-extrabold text-navy">Clienti ({customers.length})</h2>
        <p className="mb-4 text-xs font-medium text-muted">Abbonati con abbonamento attivo. Chi diventa cliente sparisce dai lead qui sotto.</p>
        <CustomersPanel customers={customers} />
      </Card>

      {/* Lead per stato & provenienza */}
      <Card>
        <h2 className="mb-1 font-display text-base font-extrabold text-navy">Lead per stato & provenienza</h2>
        <p className="mb-4 text-xs font-medium text-muted">Chi non ha un abbonamento attivo. Filtra per provenienza (Sito / Lista d&apos;attesa) e per stato.</p>
        <LeadsPanel leads={leadsRes.leads} leadError={leadsRes.leadError} />
      </Card>
    </>
  );
}
