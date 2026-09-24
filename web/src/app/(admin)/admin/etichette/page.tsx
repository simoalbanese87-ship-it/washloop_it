import Link from "next/link";
import QRCode from "qrcode";
import { Card, PageTitle } from "@/components/app/AppShell";
import { EtichettaSacco } from "@/components/admin/EtichettaSacco";
import { PrintButton } from "@/components/app/PrintButton";
import { createServiceClient } from "@/lib/supabase/server";
import { segnaTagConsegnati, annullaTagConsegnati } from "@/lib/actions/tags";
import { deleteCustomer } from "@/lib/actions/admin-customer";
import { stadioDaSubscription, type Stadio } from "@/lib/persone-stadio";
import { fmtDate } from "@/lib/format";
import { BottoneInvio } from "@/components/ui/BottoneInvio";

export const dynamic = "force-dynamic";

type Riga = {
  id: string;
  full_name: string | null;
  client_code: string | null;
  tags_delivered_at: string | null;
  tags_qty: number | null;
  is_test: boolean | null;
  created_at: string;
  subscriptions:
    | {
        status: string;
        current_period_end: string | null;
        created_at: string;
        manual: boolean | null;
        custom_price_cents: number | null;
        plans: { name: string } | null;
      }[]
    | null;
};

type Persona = Riga & { stadio: Stadio; abbonamento: string };

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
 *  **Chi conta come cliente.** Prima questa pagina metteva sullo stesso piano
 *  chiunque avesse un profilo, e annunciava «10 clienti aspettano i tag» quando
 *  i clienti veri erano tre: gli altri erano registrazioni mai diventate nulla,
 *  e prove. I tag costano carta e un giro del rider: si stampano per chi paga.
 *  Gli altri restano visibili, ma in fondo e con il loro nome — «non ancora
 *  clienti» e «non più clienti» — perché un ex cliente con i cartellini in casa
 *  è roba nostra da recuperare, non un numero da nascondere.
 *
 *  Senza parametri mostra l'elenco; `?c=<id>` prepara il foglio di una persona,
 *  `?c=tutti` di tutti i clienti, `?c=mancanti` dei clienti che non li hanno
 *  ancora ricevuti. `?n=` copie a testa (default 2: un sacco in giro e uno a
 *  casa). `?prova=1` include i profili di prova. */
export default async function EtichettePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; n?: string; ok?: string; warn?: string; prova?: string }>;
}) {
  const { c, n, ok, warn, prova } = await searchParams;
  const copie = Math.min(12, Math.max(1, parseInt(n ?? "2", 10) || 2));
  const includiProva = prova === "1";

  const svc = createServiceClient();
  const { data: righe } = await svc
    .from("profiles")
    .select("id, full_name, client_code, tags_delivered_at, tags_qty, is_test, created_at, subscriptions(status, current_period_end, created_at, manual, custom_price_cents, plans(name))")
    .eq("role", "customer")
    .not("client_code", "is", null)
    .order("created_at", { ascending: false })
    .returns<Riga[]>();

  const persone: Persona[] = (righe ?? [])
    .filter((r) => includiProva || !r.is_test)
    .map((r) => {
      // L'ultima subscription: la stessa regola di /admin/persone, così un
      // cliente non risulta attivo di là e lead di qua.
      const ultima = [...(r.subscriptions ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
      // Il piano com'è scritto sull'etichetta. Chi ha un prezzo concordato non
      // ha un piano di listino — né quando è segnato `manual`, né quando paga
      // con un link a importo libero, che è il caso di un cliente vero e che
      // faceva stampare "ABBONAMENTO: —" su un'etichetta di chi paga.
      const senzaListino = ultima && (ultima.manual || ultima.custom_price_cents != null);
      const abbonamento = ultima?.plans?.name ?? (senzaListino ? "Personalizzato" : "—");
      return { ...r, stadio: stadioDaSubscription(ultima), abbonamento };
    });

  const quantiDiProva = (righe ?? []).filter((r) => r.is_test).length;

  // Chi ha pagato: attivi e chi ha un pagamento fallito ma è cliente a tutti
  // gli effetti — il bucato glielo ritiriamo lo stesso finché non si chiude.
  const clienti = persone.filter((p) => p.stadio === "attivo" || p.stadio === "difficolta");
  const nonAncora = persone.filter((p) => p.stadio === "lead");
  const nonPiu = persone.filter((p) => p.stadio === "perso");

  const mancanti = clienti.filter((p) => !p.tags_delivered_at);
  const consegnati = clienti.length - mancanti.length;
  // Tag stampati e consegnati a chi poi se n'è andato: sono in casa sua.
  const daRecuperare = nonPiu.filter((p) => p.tags_delivered_at);

  const scelti =
    c === "tutti" ? clienti : c === "mancanti" ? mancanti : c ? persone.filter((p) => p.id === c) : [];

  // Un QR per persona scelta, generato qui: `qrcode` gira solo lato server.
  // Il QR è più grande di prima (l'etichetta è 15 cm): a 320 px sgranava.
  //
  // Le copie si alternano: la prima con nome e abbonamento — per chi maneggia
  // il sacco a casa del cliente — la seconda senza, ed è quella che può
  // arrivare al banco della lavanderia, che non deve sapere di chi sia il
  // bucato. Con il default di 2 copie ne esce una per tipo.
  const tags: { code: string; qr: string; nome: string; abbonamento: string; conNome: boolean }[] = [];
  for (const cl of scelti) {
    if (!cl.client_code) continue;
    const qr = await QRCode.toDataURL(cl.client_code, { margin: 1, width: 600 });
    for (let i = 0; i < copie; i++) {
      tags.push({
        code: cl.client_code,
        qr,
        nome: cl.full_name ?? "—",
        abbonamento: cl.abbonamento,
        conNome: i % 2 === 0,
      });
    }
  }

  if (tags.length > 0) {
    return (
      <div>
        {/* In stampa spariscono navigazione e comandi, e i tag non vengono
            spezzati a metà tra due pagine. */}
        {/* Le etichette vanno in una tasca da 15 × 6 cm: la stampa deve uscire
            in scala 1:1. Margini stretti e nessun adattamento alla pagina —
            se il browser rimpicciolisce per far stare tutto, l'etichetta non
            entra più nel porta-etichette. Ricordarsi di stampare al 100%. */}
        <style>{`@page { size: A4 portrait; margin: 8mm; }
        @media print {
          header, nav, .no-print { display: none !important; }
          body { background: #fff !important; }
          main { padding: 0 !important; }
          .tag { break-inside: avoid; page-break-inside: avoid; }
          .foglio { gap: 4mm !important; }
        }`}</style>

        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/etichette" className="font-display text-sm font-bold text-muted hover:text-navy">
            ← Torna all&apos;elenco
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted">
              {tags.length} tag · {scelti.length} {scelti.length === 1 ? "persona" : "persone"} · {copie} a testa
            </span>
            <PrintButton />
          </div>
        </div>

        <div className="no-print mb-5 rounded-[14px] border border-line bg-ice px-4 py-3 text-sm font-medium text-muted">
          Ogni etichetta misura <strong>15 × 6 cm</strong>, la misura del porta-etichette: stampa su A4 al
          <strong> 100%</strong>, senza &ldquo;adatta alla pagina&rdquo;, altrimenti esce più piccola e non entra.
          Su un foglio ne stanno quattro. Le copie si alternano: la prima con nome e abbonamento, la seconda
          senza — quella è la <strong>copia lavanderia</strong>, che al banco non deve dire di chi sia il bucato.
          Dopo averle consegnate, torna all&apos;elenco e segnale come consegnate: è l&apos;unico modo per sapere
          poi chi manca.
        </div>

        <div className="foglio flex flex-col items-start gap-4">
          {tags.map((t, i) => (
            <EtichettaSacco
              key={`${t.code}-${i}`}
              clientCode={t.code}
              qrDataUrl={t.qr}
              nome={t.nome}
              abbonamento={t.abbonamento}
              conNome={t.conNome}
            />
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

      {ok && <div className="mb-4 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] bg-[#C9881F]/12 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <Card className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-navy">
              {clienti.length === 0
                ? "Nessun cliente attivo"
                : mancanti.length === 0
                  ? "Tutti i clienti hanno i tag"
                  : `${mancanti.length} ${mancanti.length === 1 ? "cliente aspetta" : "clienti aspettano"} i tag`}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted">
              {consegnati} consegnati su {clienti.length} {clienti.length === 1 ? "cliente" : "clienti"} che pagano.
              {nonAncora.length > 0 && ` Altri ${nonAncora.length} si sono registrati senza mai attivare: non aspettano niente.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mancanti.length > 0 && (
              <Link
                href={`/admin/etichette?c=mancanti&n=2${includiProva ? "&prova=1" : ""}`}
                className="rounded-full bg-navy px-5 py-2.5 font-display text-sm font-extrabold text-white"
              >
                Stampa solo chi manca →
              </Link>
            )}
            {clienti.length > 0 && (
              <Link
                href={`/admin/etichette?c=tutti&n=2${includiProva ? "&prova=1" : ""}`}
                className="rounded-full border-2 border-navy/20 px-5 py-2.5 font-display text-sm font-extrabold text-navy"
              >
                Stampa tutti i clienti
              </Link>
            )}
          </div>
        </div>

        {quantiDiProva > 0 && (
          <Link
            href={includiProva ? "/admin/etichette" : "/admin/etichette?prova=1"}
            className="mt-3 inline-block font-display text-xs font-bold text-muted hover:text-navy"
          >
            {includiProva ? "← Nascondi i dati di prova" : `Mostra anche i ${quantiDiProva} profili di prova →`}
          </Link>
        )}
      </Card>

      {daRecuperare.length > 0 && (
        <Card className="mb-6 border-[#C9881F]/30 bg-[#C9881F]/6">
          <h2 className="font-display text-base font-extrabold text-[#C9881F]">
            {daRecuperare.length === 1 ? "Un tag è a casa di un ex cliente" : `${daRecuperare.length} tag sono a casa di ex clienti`}
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#C9881F]">
            Hanno ricevuto i cartellini e poi hanno disdetto: o si recuperano al prossimo passaggio, o quel codice
            resta in giro. {daRecuperare.map((p) => `${p.full_name ?? "—"} (${p.client_code})`).join(" · ")}
          </p>
        </Card>
      )}

      <Card>
        <h2 className="font-display text-base font-extrabold text-navy">Clienti</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Chi ha un abbonamento in corso. Segna la consegna quando i tag sono materialmente nelle mani del cliente,
          non quando li stampi.
        </p>
        <div className="mt-3 divide-y divide-line">
          {clienti.map((cl) => (
            <RigaPersona key={cl.id} p={cl} includiProva={includiProva} />
          ))}
          {clienti.length === 0 && (
            <p className="py-3 text-sm font-medium text-muted">
              Nessun cliente con abbonamento in corso: finché non ce n&apos;è uno, non c&apos;è niente da stampare.
            </p>
          )}
        </div>
      </Card>

      {nonAncora.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-display text-base font-extrabold text-navy">Non ancora clienti</h2>
          <p className="mt-1 text-sm font-medium text-muted">
            Hanno aperto un account e non hanno mai attivato un abbonamento. Il codice ce l&apos;hanno già, ma i tag
            si stampano quando diventano clienti. Se sono registrazioni morte o prove, si eliminano da qui.
          </p>
          <div className="mt-3 divide-y divide-line">
            {nonAncora.map((cl) => (
              <RigaPersona key={cl.id} p={cl} includiProva={includiProva} eliminabile />
            ))}
          </div>
        </Card>
      )}

      {nonPiu.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-display text-base font-extrabold text-navy">Non più clienti</h2>
          <p className="mt-1 text-sm font-medium text-muted">
            Abbonamento disdetto o scaduto. Non contano fra chi aspetta i tag: se tornano, il loro codice è ancora
            quello.
          </p>
          <div className="mt-3 divide-y divide-line">
            {nonPiu.map((cl) => (
              <RigaPersona key={cl.id} p={cl} includiProva={includiProva} eliminabile />
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

/** Una riga dell'elenco: chi è, se ha i tag, e cosa ci si può fare.
 *
 *  `eliminabile` aggiunge la cancellazione definitiva, che ha senso solo per
 *  chi non è un cliente attivo. Le guardie vere stanno in `deleteCustomer`
 *  (abbonamento in corso, ordini aperti): qui si evita solo di offrire un
 *  bottone che verrebbe rifiutato. */
function RigaPersona({ p, includiProva, eliminabile }: { p: Persona; includiProva: boolean; eliminabile?: boolean }) {
  const q = includiProva ? "&prova=1" : "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/abbonati/${p.id}`} className="truncate font-display text-sm font-bold text-navy hover:text-blue">
            {p.full_name ?? "—"}
          </Link>
          {p.is_test && (
            <span className="flex-none rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-navy/60">
              Prova
            </span>
          )}
          {p.tags_delivered_at ? (
            <span className="flex-none rounded-full bg-[#1F8A5B]/12 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#1F8A5B]">
              Consegnati
            </span>
          ) : (
            p.stadio !== "lead" && (
              <span className="flex-none rounded-full bg-[#C9881F]/12 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#C9881F]">
                Da consegnare
              </span>
            )
          )}
        </div>
        <div className="font-mono text-xs font-semibold text-muted">
          {p.client_code}
          {p.tags_delivered_at ? (
            <span className="ml-2 font-sans font-medium">
              {p.tags_qty ?? "—"} tag · {fmtDate(p.tags_delivered_at)}
            </span>
          ) : (
            <span className="ml-2 font-sans font-medium">registrato il {fmtDate(p.created_at)}</span>
          )}
        </div>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-3">
        <Link href={`/admin/etichette?c=${p.id}&n=1${q}`} className="font-display text-[11px] font-bold text-blue hover:underline">1</Link>
        <Link href={`/admin/etichette?c=${p.id}&n=2${q}`} className="font-display text-[11px] font-bold text-blue hover:underline">2</Link>
        <Link href={`/admin/etichette?c=${p.id}&n=4${q}`} className="font-display text-[11px] font-bold text-blue hover:underline">4 tag</Link>

        {p.tags_delivered_at ? (
          <form action={annullaTagConsegnati}>
            <input type="hidden" name="cliente_id" value={p.id} />
            <input type="hidden" name="back" value={`/admin/etichette${includiProva ? "?prova=1" : ""}`} />
            <BottoneInvio className="font-display text-[11px] font-bold text-[#C0392B]/70 hover:underline">
              Annulla consegna
            </BottoneInvio>
          </form>
        ) : (
          <form action={segnaTagConsegnati} className="flex items-center gap-1.5">
            <input type="hidden" name="cliente_id" value={p.id} />
            <input type="hidden" name="back" value={`/admin/etichette${includiProva ? "?prova=1" : ""}`} />
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

        {eliminabile && (
          <details className="relative">
            <summary className="cursor-pointer list-none font-display text-[11px] font-bold text-[#C0392B]/70 hover:underline">
              Elimina
            </summary>
            <form action={deleteCustomer} className="mt-1.5 flex items-center gap-2 rounded-[10px] border border-[#C0392B]/25 bg-white px-2.5 py-2">
              <input type="hidden" name="customer_id" value={p.id} />
              <input type="hidden" name="back" value={`/admin/etichette${includiProva ? "?prova=1" : ""}`} />
              <span className="text-[11px] font-semibold text-navy">Cancella tutto di questa persona?</span>
              <BottoneInvio className="rounded-full bg-[#C0392B] px-3 py-1 font-display text-[11px] font-extrabold text-white">
                Sì, elimina
              </BottoneInvio>
            </form>
          </details>
        )}
      </div>
    </div>
  );
}
