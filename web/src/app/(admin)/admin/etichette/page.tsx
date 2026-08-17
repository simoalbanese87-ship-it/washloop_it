import Link from "next/link";
import QRCode from "qrcode";
import { Card, PageTitle } from "@/components/app/AppShell";
import { BagTag } from "@/components/admin/BagTag";
import { PrintButton } from "@/components/app/PrintButton";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Cliente = { id: string; full_name: string | null; client_code: string | null };

/** Stampa dei tag per i sacchi.
 *
 *  Il tag appartiene al CLIENTE, non all'ordine: il codice `WL-####` è assegnato
 *  alla registrazione e non cambia più, quindi si stampa una volta e resta sul
 *  sacco. Prima l'unica stampa disponibile era agganciata al singolo ordine, e
 *  ristampava a ogni ritiro lo stesso identico QR, un ordine per volta.
 *
 *  Senza parametri mostra l'elenco dei clienti; con `?c=<id>` prepara il foglio
 *  da stampare, `?n=` copie per cliente (default 2, un sacco di riserva).
 *  `?c=tutti` prepara il foglio per chiunque abbia un codice. */
export default async function EtichettePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; n?: string }>;
}) {
  const { c, n } = await searchParams;
  const copie = Math.min(12, Math.max(1, parseInt(n ?? "2", 10) || 2));

  const svc = createServiceClient();
  const { data: clienti } = await svc
    .from("profiles")
    .select("id, full_name, client_code")
    .eq("role", "customer")
    .not("client_code", "is", null)
    .order("created_at", { ascending: false })
    .returns<Cliente[]>();

  const tutti = clienti ?? [];
  const scelti = c === "tutti" ? tutti : c ? tutti.filter((x) => x.id === c) : [];

  // Un QR per cliente scelto, generato qui: `qrcode` gira solo lato server.
  const tags: { code: string; nome: string; qr: string }[] = [];
  for (const cl of scelti) {
    if (!cl.client_code) continue;
    const qr = await QRCode.toDataURL(cl.client_code, { margin: 1, width: 320 });
    for (let i = 0; i < copie; i++) tags.push({ code: cl.client_code, nome: cl.full_name ?? "—", qr });
  }

  if (tags.length > 0) {
    return (
      <div>
        {/* In stampa spariscono navigazione e comandi, e i tag non vengono
            spezzati a metà tra due pagine. */}
        <style>{`@media print {
          header, nav, .no-print { display: none !important; }
          body { background: #fff !important; }
          main { padding: 0 !important; }
          .tag { break-inside: avoid; page-break-inside: avoid; }
        }`}</style>

        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/etichette" className="font-display text-sm font-bold text-muted hover:text-navy">
            ← Scegli altri clienti
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted">
              {tags.length} tag · {scelti.length} {scelti.length === 1 ? "cliente" : "clienti"} · {copie} per cliente
            </span>
            <PrintButton />
          </div>
        </div>

        <div className="no-print mb-5 rounded-[14px] border border-line bg-ice px-4 py-3 text-sm font-medium text-muted">
          Stampa su carta adesiva A4 e applica un tag per sacco. Il codice non cambia mai: si stampa una volta sola.
          Sul tag non compaiono nome, indirizzo, telefono né la lavanderia — al banco deve arrivare solo il codice.
        </div>

        <div className="flex flex-wrap gap-4">
          {tags.map((t, i) => (
            <BagTag key={`${t.code}-${i}`} clientCode={t.code} qrDataUrl={t.qr} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageTitle
        kicker="Etichette"
        title="Tag per i sacchi"
        sub="Un QR per cliente, da stampare una volta e lasciare sul sacco. Ritiro e riconsegna leggono lo stesso codice."
      />

      <Card className="mb-6">
        <h2 className="font-display text-base font-extrabold text-navy">Stampa in blocco</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Tutti i {tutti.length} clienti con codice assegnato, due tag ciascuno.
        </p>
        <Link
          href="/admin/etichette?c=tutti&n=2"
          className="mt-3 inline-block rounded-full bg-navy px-5 py-2.5 font-display text-sm font-extrabold text-white"
        >
          Prepara il foglio →
        </Link>
      </Card>

      <Card>
        <h2 className="font-display text-base font-extrabold text-navy">Un cliente alla volta</h2>
        <div className="mt-3 divide-y divide-line">
          {tutti.map((cl) => (
            <div key={cl.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-bold text-navy">{cl.full_name ?? "—"}</div>
                <div className="font-mono text-xs font-semibold text-muted">{cl.client_code}</div>
              </div>
              <div className="flex flex-none gap-3">
                <Link href={`/admin/etichette?c=${cl.id}&n=1`} className="font-display text-[11px] font-bold text-blue hover:underline">1 tag</Link>
                <Link href={`/admin/etichette?c=${cl.id}&n=2`} className="font-display text-[11px] font-bold text-blue hover:underline">2 tag</Link>
                <Link href={`/admin/etichette?c=${cl.id}&n=4`} className="font-display text-[11px] font-bold text-blue hover:underline">4 tag</Link>
              </div>
            </div>
          ))}
          {tutti.length === 0 && <p className="py-3 text-sm font-medium text-muted">Nessun cliente con codice assegnato.</p>}
        </div>
      </Card>
    </>
  );
}
