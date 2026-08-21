import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/app/AppShell";
import { righeMetrica, isChiaveMetrica } from "@/lib/metrica-righe";

export const dynamic = "force-dynamic";

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

/** Il dettaglio dietro un numero della Home.
 *
 *  Serve a rispondere a «da chi è composto?» senza aprire il database: ogni
 *  riga è un pezzo del totale, e cliccandola si arriva al cliente o all'ordine
 *  che l'ha generata. Se la somma delle righe non fa il totale mostrato in
 *  Home, è un errore da correggere — non un arrotondamento. */
export default async function DettaglioNumero({
  params,
  searchParams,
}: {
  params: Promise<{ metrica: string }>;
  searchParams: Promise<{ prova?: string }>;
}) {
  const { metrica } = await params;
  const { prova } = await searchParams;
  if (!isChiaveMetrica(metrica)) notFound();

  const includiProva = prova === "1";
  const d = await righeMetrica(metrica, includiProva);

  return (
    <>
      <Link href="/admin" className="font-display text-sm font-bold text-navy/55 hover:text-navy">
        ← Home
      </Link>

      <div className="mt-2">
        <PageTitle kicker="Dettaglio" title={d.titolo} sub={d.spiegazione} />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="font-display text-[34px] font-black leading-none text-navy">
              {d.totaleCents !== undefined ? eur(d.totaleCents) : (d.totaleQuantita ?? d.righe.length)}
            </div>
            <div className="mt-1 text-sm font-medium text-muted">
              {d.righe.length} {d.righe.length === 1 ? "voce" : "voci"} · la somma delle righe qui sotto
            </div>
          </div>
          <Link
            href={`/admin/numeri/${metrica}${includiProva ? "" : "?prova=1"}`}
            className="rounded-full border border-line px-4 py-2 font-display text-xs font-bold text-navy"
          >
            {includiProva ? "Nascondi dati di prova" : "Mostra anche i dati di prova"}
          </Link>
        </div>
      </Card>

      <Card>
        <div className="divide-y divide-line">
          {d.righe.map((r, i) => {
            const corpo = (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-bold text-navy">{r.etichetta}</div>
                  <div className="text-xs font-medium text-muted">{r.dettaglio}</div>
                  {r.nota && <div className="mt-0.5 text-xs font-semibold text-[#C9881F]">{r.nota}</div>}
                </div>
                <div className="flex-none font-display text-sm font-extrabold text-navy">
                  {r.importoCents !== undefined ? eur(r.importoCents) : r.quantita !== undefined ? r.quantita : ""}
                </div>
              </div>
            );
            return r.href ? (
              <Link key={i} href={r.href} className="block transition-colors hover:bg-ice/60">
                {corpo}
              </Link>
            ) : (
              <div key={i}>{corpo}</div>
            );
          })}
          {d.righe.length === 0 && (
            <p className="py-3 text-sm font-medium text-muted">
              Nessuna voce{includiProva ? "" : " — prova a includere i dati di prova"}.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
