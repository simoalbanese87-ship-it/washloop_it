import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { gatherDigest } from "@/lib/digest";
import { sendDigestNow } from "@/lib/actions/digest";
import { fmtFull } from "@/lib/format";

const SUB_LABEL: Record<string, string> = {
  active: "Attivo", trialing: "In prova", past_due: "Pagamento sospeso",
  unpaid: "Non pagato", canceled: "Disdetto", paused: "In pausa",
  incomplete: "Da attivare", pending: "Pending (lead)",
};
const tone = (s: string) =>
  s === "active" || s === "trialing" ? "bg-[#1F8A5B]/15 text-[#1F8A5B]"
    : s === "past_due" || s === "unpaid" ? "bg-[#C0392B]/12 text-[#C0392B]"
    : "bg-[#C9881F]/15 text-[#C9881F]";

export default async function NovitaPage({ searchParams }: { searchParams: Promise<{ ok?: string; warn?: string }> }) {
  const { ok, warn } = await searchParams;
  const data = await gatherDigest(24 * 7); // vista 7 giorni

  return (
    <>
      <PageTitle kicker="Novità" title="Nuovi clienti & lead" sub="Ultimi 7 giorni · digest email automatico ogni mattina" />

      {ok && <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-line bg-ice px-4 py-3">
        <div className="text-sm font-medium text-muted">
          Ogni mattina inviamo agli admin un&apos;email con i nuovi clienti e lead delle ultime 24 ore. Puoi inviarlo subito come test.
        </div>
        <form action={sendDigestNow}>
          <Button type="submit" size="md">📧 Invia digest ora</Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Nuovi clienti */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Nuovi clienti ({data.newCustomers.length})</h2>
          <div className="mt-3 space-y-2">
            {data.newCustomers.length === 0 ? (
              <p className="text-sm font-medium text-muted">Nessun nuovo cliente negli ultimi 7 giorni.</p>
            ) : (
              data.newCustomers.map((c) => (
                <Link key={c.id} href={`/admin/abbonati/${c.id}`} className="flex items-center justify-between gap-3 rounded-[12px] border border-line px-3 py-2 text-sm transition-colors hover:bg-ice">
                  <div className="min-w-0">
                    <div className="font-bold text-navy">{c.name}</div>
                    <div className="truncate text-xs font-medium text-muted">{c.email ?? "—"}{c.phone ? ` · ${c.phone}` : ""} · {fmtFull(c.created_at)}</div>
                  </div>
                  <span className={`flex-none rounded-full px-2 py-0.5 font-display text-[11px] font-bold ${tone(c.status)}`}>{SUB_LABEL[c.status] ?? c.status}</span>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Nuovi lead */}
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Nuovi lead — funnel ({data.newLeads.length})</h2>
          <div className="mt-3 space-y-2">
            {data.leadError ? (
              <p className="rounded-[10px] bg-[#C9881F]/10 px-3 py-2 text-xs font-semibold text-[#C9881F]">Lista d&apos;attesa non raggiungibile: {data.leadError}</p>
            ) : data.newLeads.length === 0 ? (
              <p className="text-sm font-medium text-muted">Nessun nuovo lead negli ultimi 7 giorni.</p>
            ) : (
              data.newLeads.map((l, i) => (
                <div key={i} className="rounded-[12px] border border-line px-3 py-2 text-sm">
                  <div className="font-bold text-navy">{l.name}</div>
                  <div className="text-xs font-medium text-muted">
                    {[l.email, l.phone].filter(Boolean).join(" · ") || "—"}{l.address ? ` · ${l.address}` : ""}{l.dateLabel ? ` · ${l.dateLabel}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
          <Link href="/admin/lista-attesa" className="mt-3 inline-flex font-display text-sm font-bold text-blue hover:underline">Tutti i lead →</Link>
        </Card>
      </div>
    </>
  );
}
