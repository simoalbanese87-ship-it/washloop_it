import Link from "next/link";
import QRCode from "qrcode";
import { Card, PageTitle } from "@/components/app/AppShell";
import { BagTag } from "@/components/admin/BagTag";
import { PrintButton } from "@/components/app/PrintButton";
import { createServiceClient } from "@/lib/supabase/server";
import { segnaTagConsegnati, annullaTagConsegnati } from "@/lib/actions/tags";
import { fmtDate } from "@/lib/format";
import { BottoneInvio } from "@/components/ui/BottoneInvio";

export const dynamic = "force-dynamic";

type Cliente = {
  id: string;
  full_name: string | null;
  client_code: string | null;
  tags_delivered_at: string | null;
  tags_qty: number | null;
};

/** Stampa e gestione dei tag QR per i sacchi.
 *
 *  Il tag appartiene al CLIENTE, non all'ordine: il codice `WL-####` è assegnato
 *  alla registrazione e non cambia più, quindi si stampa una volta e resta sul
 *  sacco. Prima l'unica stampa disponibile era agganciata al singolo ordine, e
 *  ristampava a ogni ritiro lo stesso identico QR, un ordine per volta.
 *
 *  La domanda operativa non è chi ha un codice — ce l'hanno tutti — ma a chi
 *  abbiamo già dato i cartellini in mano: quella è l'unica informazione che, se
 *  non la registriamo, non si ricostruisce più da nessun dato del sistema.
 *
 *  Senza parametri mostra l'elenco; `?c=<id>` prepara il foglio di un cliente,
 *  `?c=tutti` di tutti, `?c=mancanti` solo di chi non li ha ancora ricevuti.
 *  `?n=` copie per cliente (default 2: un sacco in giro e uno a casa). */
export default async function EtichettePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; n?: string; ok?: string; warn?: string }>;
}) {
  const { c, n, ok, warn } = await searchParams;
  const copie = Math.min(12, Math.max(1, parseInt(n ?? "2", 10) || 2));

  const svc = createServiceClient();
  const { data: clienti } = await svc
    .from("profiles")
    .select("id, full_name, client_code, tags_delivered_at, tags_qty")
    .eq("role", "customer")
    .not("client_code", "is", null)
    .order("created_at", { ascending: false })
    .returns<Cliente[]>();

  const tutti = clienti ?? [];
  const mancanti = tutti.filter((x) => !x.tags_delivered_at);
  const scelti =
    c === "tutti" ? tutti : c === "mancanti" ? mancanti : c ? tutti.filter((x) => x.id === c) : [];

  // Un QR per cliente scelto, generato qui: `qrcode` gira solo lato server.
  const tags: { code: string; qr: string }[] = [];
  for (const cl of scelti) {
    if (!cl.client_code) continue;
    const qr = await QRCode.toDataURL(cl.client_code, { margin: 1, width: 320 });
    for (let i = 0; i < copie; i++) tags.push({ code: cl.client_code, qr });
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
            ← Torna all&apos;elenco
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted">
              {tags.length} tag · {scelti.length} {scelti.length === 1 ? "cliente" : "clienti"} · {copie} per cliente
            </span>
            <PrintButton />
          </div>
        </div>

        <div className="no-print mb-5 rounded-[14px] border border-line bg-ice px-4 py-3 text-sm font-medium text-muted">
          Stampa su carta adesiva A4 e applica un tag per sacco. Dopo averli consegnati, torna all&apos;elenco e
          segnali come consegnati: è l&apos;unico modo per sapere poi chi manca. Sul tag non compaiono nome,
          indirizzo, telefono né la lavanderia — al banco deve arrivare solo il codice.
        </div>

        <div className="flex flex-wrap gap-4">
          {tags.map((t, i) => (
            <BagTag key={`${t.code}-${i}`} clientCode={t.code} qrDataUrl={t.qr} />
          ))}
        </div>
      </div>
    );
  }

  const consegnati = tutti.length - mancanti.length;

  return (
    <>
      <PageTitle
        kicker="Etichette"
        title="Tag per i sacchi"
        sub="Un QR per cliente, da stampare una volta e lasciare sul sacco. Ritiro e riconsegna leggono lo stesso codice."
      />

      {ok && <div className="mb-4 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] bg-[#C9881F]/12 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <Card className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-navy">
              {mancanti.length === 0 ? "Tutti i clienti hanno i tag" : `${mancanti.length} ${mancanti.length === 1 ? "cliente aspetta" : "clienti aspettano"} i tag`}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted">
              {consegnati} consegnati su {tutti.length}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mancanti.length > 0 && (
              <Link
                href="/admin/etichette?c=mancanti&n=2"
                className="rounded-full bg-navy px-5 py-2.5 font-display text-sm font-extrabold text-white"
              >
                Stampa solo chi manca →
              </Link>
            )}
            <Link
              href="/admin/etichette?c=tutti&n=2"
              className="rounded-full border-2 border-navy/20 px-5 py-2.5 font-display text-sm font-extrabold text-navy"
            >
              Stampa tutti
            </Link>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-base font-extrabold text-navy">Clienti</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Segna la consegna quando i tag sono materialmente nelle mani del cliente, non quando li stampi.
        </p>
        <div className="mt-3 divide-y divide-line">
          {tutti.map((cl) => (
            <div key={cl.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-sm font-bold text-navy">{cl.full_name ?? "—"}</span>
                  {cl.tags_delivered_at ? (
                    <span className="flex-none rounded-full bg-[#1F8A5B]/12 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#1F8A5B]">
                      Consegnati
                    </span>
                  ) : (
                    <span className="flex-none rounded-full bg-[#C9881F]/12 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#C9881F]">
                      Da consegnare
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs font-semibold text-muted">
                  {cl.client_code}
                  {cl.tags_delivered_at && (
                    <span className="ml-2 font-sans font-medium">
                      {cl.tags_qty ?? "—"} tag · {fmtDate(cl.tags_delivered_at)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-none flex-wrap items-center gap-3">
                <Link href={`/admin/etichette?c=${cl.id}&n=1`} className="font-display text-[11px] font-bold text-blue hover:underline">1</Link>
                <Link href={`/admin/etichette?c=${cl.id}&n=2`} className="font-display text-[11px] font-bold text-blue hover:underline">2</Link>
                <Link href={`/admin/etichette?c=${cl.id}&n=4`} className="font-display text-[11px] font-bold text-blue hover:underline">4 tag</Link>

                {cl.tags_delivered_at ? (
                  <form action={annullaTagConsegnati}>
                    <input type="hidden" name="cliente_id" value={cl.id} />
                    <BottoneInvio className="font-display text-[11px] font-bold text-[#C0392B]/70 hover:underline">
                      Annulla consegna
                    </BottoneInvio>
                  </form>
                ) : (
                  <form action={segnaTagConsegnati} className="flex items-center gap-1.5">
                    <input type="hidden" name="cliente_id" value={cl.id} />
                    <input
                      type="number"
                      name="qty"
                      min={1}
                      max={20}
                      defaultValue={2}
                      aria-label="Quanti tag"
                      className="h-8 w-14 rounded-[10px] border border-line bg-ice px-2 text-xs font-semibold text-navy outline-none focus:border-blue"
                    />
                    <BottoneInvio className="rounded-full bg-navy/90 px-3 py-1.5 font-display text-[11px] font-bold text-white">
                      Segna consegnati
                    </BottoneInvio>
                  </form>
                )}
              </div>
            </div>
          ))}
          {tutti.length === 0 && <p className="py-3 text-sm font-medium text-muted">Nessun cliente con codice assegnato.</p>}
        </div>
      </Card>
    </>
  );
}
