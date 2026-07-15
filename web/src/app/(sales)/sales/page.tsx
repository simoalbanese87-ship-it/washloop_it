import { Card, PageTitle } from "@/components/app/AppShell";
import { LeadsPanel } from "@/components/admin/LeadsPanel";
import { leadsByStatusSource } from "@/lib/admin-metrics";

export default async function SalesLeadsPage() {
  const { leads, leadError } = await leadsByStatusSource();
  const site = leads.filter((l) => l.source === "site").length;
  const funnel = leads.filter((l) => l.source === "funnel").length;

  return (
    <>
      <PageTitle kicker="Sales" title="Lead" sub={`${leads.length} lead da lavorare · ${site} dal sito · ${funnel} lista d'attesa`} />
      <Card>
        <h2 className="mb-1 font-display text-base font-extrabold text-navy">Lead per stato &amp; provenienza</h2>
        <p className="mb-4 text-xs font-medium text-muted">Chi non ha ancora un abbonamento attivo. Filtra per provenienza e stato. Chi diventa cliente sparisce da qui.</p>
        <LeadsPanel leads={leads} leadError={leadError} readOnly />
      </Card>
    </>
  );
}
