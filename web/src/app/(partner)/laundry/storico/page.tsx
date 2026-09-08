import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { STATI_CHIUSI, type OrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Lo storico della lavanderia: quanti sacchi, quali capi, quanto le spetta.
 *
 *  Perché mancava, e perché è un problema
 *  --------------------------------------
 *  Il portale mostrava soltanto il lavoro in corso: appena un ordine veniva
 *  consegnato spariva, e con lui i sacchi e i capi extra di quel giro. La
 *  lavanderia non poteva rispondere né a «quanti sacchi vi ho lavato a
 *  settembre» né a «quali extra ho segnato» — cioè non poteva **controllare il
 *  proprio compenso**. Chi non può verificare quanto gli spetta ha una sola
 *  scelta: fidarsi. E prima o poi smette.
 *
 *  I dati c'erano già tutti, sparsi in tre posti che la lavanderia ha il
 *  permesso di leggere: `partner_orders` (i ritiri), `partner_order_specials`
 *  (i capi) e `laundry_payouts` (il dovuto). Mancava la pagina.
 *
 *  Il mese si sceglie dall'indirizzo (`?mese=2026-09`): è un archivio, e un
 *  archivio deve avere un collegamento che si può salvare e mandare. */

type Ordine = {
  order_id: string;
  client_code: string | null;
  bags: number;
  bags_scansionati: number;
  bags_arrivati: number | null;
  status: OrderStatus;
  created_at: string;
};
type Capo = { id: string; order_id: string; item_name: string; qty: number; comp_lav_cents: number; created_at: string };
type Compenso = { order_id: string | null; kind: string; amount_cents: number; status: string; created_at: string; paid_at: string | null };

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

/** Il primo istante del mese, in ora di Roma, come stringa ISO.
 *
 *  `new Date("2026-09-01")` è mezzanotte UTC, che a Roma è le 02:00 del 1°:
 *  un ritiro registrato all'una di notte finirebbe nel mese sbagliato. Il
 *  suffisso lo mette a posto senza tirare dentro una libreria. */
function inizioMeseRoma(anno: number, mese: number): string {
  const m = String(mese).padStart(2, "0");
  // Da fine marzo a fine ottobre l'Italia è a +02:00, il resto dell'anno +01:00.
  const legale = mese >= 4 && mese <= 9;
  return `${anno}-${m}-01T00:00:00${legale ? "+02:00" : "+01:00"}`;
}

export default async function StoricoLavanderia({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string }>;
}) {
  const { mese } = await searchParams;
  const oggi = new Date();
  const scelto = /^\d{4}-\d{2}$/.test(mese ?? "") ? mese! : `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}`;
  const [anno, numMese] = scelto.split("-").map(Number);

  const dal = inizioMeseRoma(anno, numMese);
  const al = numMese === 12 ? inizioMeseRoma(anno + 1, 1) : inizioMeseRoma(anno, numMese + 1);
  const passo = (n: number) => {
    const d = new Date(anno, numMese - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const etichettaMese = new Date(anno, numMese - 1, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const supabase = await createClient();
  const [{ data: ordiniDelMese }, { data: capi }, { data: compensi }] = await Promise.all([
    supabase
      .from("partner_orders")
      .select("order_id, client_code, bags, bags_scansionati, bags_arrivati, status, created_at")
      .gte("created_at", dal)
      .lt("created_at", al)
      .order("created_at", { ascending: false })
      .returns<Ordine[]>(),
    supabase
      .from("partner_order_specials")
      .select("id, order_id, item_name, qty, comp_lav_cents, created_at")
      .gte("created_at", dal)
      .lt("created_at", al)
      .order("created_at")
      .returns<Capo[]>(),
    // Il dovuto vero. Si scrive alla riconsegna, quindi gli ordini ancora in
    // lavorazione non hanno righe: la differenza fra le due colonne del
    // riepilogo è esattamente il lavoro non ancora chiuso.
    supabase
      .from("laundry_payouts")
      .select("order_id, kind, amount_cents, status, created_at, paid_at")
      .gte("created_at", dal)
      .lt("created_at", al)
      .neq("status", "void")
      .returns<Compenso[]>(),
  ]);

  // Un capo registrato a settembre può stare su un ritiro di fine agosto: il
  // riepilogo lo contava e la tabella no, quindi la pagina diceva «5 capi
  // extra» e sotto mostrava solo trattini. Si recuperano anche quegli ordini.
  const idDelMese = new Set((ordiniDelMese ?? []).map((o) => o.order_id));
  const mancanti = [...new Set((capi ?? []).map((c) => c.order_id))].filter((id) => !idDelMese.has(id));
  const { data: ordiniDeiCapi } = mancanti.length
    ? await supabase
        .from("partner_orders")
        .select("order_id, client_code, bags, bags_scansionati, bags_arrivati, status, created_at")
        .in("order_id", mancanti)
        .returns<Ordine[]>()
    : { data: [] as Ordine[] };

  const righe = [...(ordiniDelMese ?? []), ...(ordiniDeiCapi ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const capiPerOrdine = new Map<string, Capo[]>();
  for (const c of capi ?? []) capiPerOrdine.set(c.order_id, [...(capiPerOrdine.get(c.order_id) ?? []), c]);

  // I sacchi che contano: quelli contati sul banco. Dove il conteggio non c'è
  // ancora si usa quello del rider, e in mancanza di scansioni la previsione.
  const sacchiDi = (o: Ordine) => o.bags_arrivati ?? (o.bags_scansionati || o.bags);
  // I sacchi del mese sono quelli dei ritiri del mese. Gli ordini più vecchi
  // stanno in tabella solo perché nel mese hanno avuto un capo extra: i loro
  // sacchi sono già stati contati nel mese in cui sono arrivati, e sommarli qui
  // li conterebbe due volte.
  const totaleSacchi = (ordiniDelMese ?? []).reduce((t, o) => t + sacchiDi(o), 0);
  const totaleCapi = (capi ?? []).reduce((t, c) => t + c.qty, 0);
  const dovutoCents = (compensi ?? []).reduce((t, r) => t + r.amount_cents, 0);
  const daLiquidare = (compensi ?? []).filter((r) => r.status === "pending").reduce((t, r) => t + r.amount_cents, 0);
  const pagate = (compensi ?? []).filter((r) => r.status === "settled");
  const pagatoCents = pagate.reduce((t, r) => t + r.amount_cents, 0);
  // Quando è stato fatto il pagamento. Le righe liquidate prima che esistesse
  // questa data non ce l'hanno, e si dice invece di inventarla.
  const datePagamento = [...new Set(pagate.map((r) => r.paid_at).filter(Boolean) as string[])].sort();
  const pagateSenzaData = pagate.filter((r) => !r.paid_at).length;
  const daContare = righe.filter((o) => o.bags_arrivati == null && !STATI_CHIUSI.includes(o.status)).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle
          kicker="Portale lavanderia"
          title="Storico"
          sub={`${etichettaMese} · sacchi, capi e compensi`}
        />
        <div className="mt-1 flex items-center gap-3">
          <Link href={`/laundry/storico?mese=${passo(-1)}`} className="font-display text-sm font-bold text-blue hover:underline">
            ← mese prima
          </Link>
          <Link href={`/laundry/storico?mese=${passo(1)}`} className="font-display text-sm font-bold text-blue hover:underline">
            mese dopo →
          </Link>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Riquadro valore={String(totaleSacchi)} etichetta="sacchi lavati" />
        <Riquadro valore={String(totaleCapi)} etichetta="capi extra" />
        <Riquadro valore={eur(dovutoCents)} etichetta="compenso maturato" />
        <Riquadro valore={eur(daLiquidare)} etichetta="ancora da pagare" tono={daLiquidare > 0 ? "attesa" : undefined} />
      </div>

      {/* Quando i soldi sono stati mandati.
          «Pagato» senza una data è una parola: chi aspetta il bonifico deve
          poterla confrontare con l'estratto conto. */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-display text-sm font-extrabold text-navy">Pagamenti</span>
          <span className="font-display text-base font-black text-[#1F8A5B]">{eur(pagatoCents)} già pagati</span>
        </div>
        {pagate.length === 0 ? (
          <p className="mt-1 text-sm font-medium text-muted">
            In questo mese non è ancora stato pagato niente. {daLiquidare > 0 ? `Restano ${eur(daLiquidare)} maturati in attesa del bonifico.` : ""}
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm font-medium text-muted">
              {datePagamento.length > 0
                ? `Segnati come pagati il ${datePagamento.map((d) => fmtDate(d)).join(", ")}.`
                : "Segnati come pagati."}
              {pagateSenzaData > 0 && ` ${pagateSenzaData} ${pagateSenzaData === 1 ? "riga è stata liquidata" : "righe sono state liquidate"} prima che registrassimo la data: non ce l'hanno.`}
            </p>
            {daLiquidare > 0 && (
              <p className="mt-2 rounded-[12px] bg-[#C9881F]/12 px-3 py-2 text-sm font-semibold text-[#C9881F]">
                Restano {eur(daLiquidare)} maturati e non ancora pagati.
              </p>
            )}
          </>
        )}
        <p className="mt-2 text-xs font-medium text-muted">
          Il pagamento lo segna WashLoop quando parte il bonifico: quello che vedi qui è il nostro registro,
          non l&apos;estratto conto della banca. Se una cifra non corrisponde, scrivici con il mese.
        </p>
      </Card>

      <Card className="mb-4">
        <p className="text-sm font-medium text-muted">
          Il <strong className="text-navy">compenso maturato</strong> si scrive alla riconsegna: gli
          ordini ancora sul banco non compaiono ancora in quella cifra, ma i loro sacchi sì. I{" "}
          <strong className="text-navy">sacchi</strong> sono quelli che hai contato tu all&apos;arrivo:
          è quel numero che fa il compenso, non quello previsto in prenotazione.
        </p>
        {daContare > 0 && (
          <p className="mt-2 rounded-[12px] bg-[#C9881F]/12 px-3 py-2 text-sm font-semibold text-[#C9881F]">
            {daContare} {daContare === 1 ? "ordine è ancora senza conteggio" : "ordini sono ancora senza conteggio"}:
            apri la scheda e scrivi quanti sacchi hai ricevuto, così il compenso parte dal numero giusto.
          </p>
        )}
      </Card>

      {righe.length === 0 ? (
        <Card>
          <p className="text-sm font-medium text-muted">Nessun ritiro in questo mese.</p>
        </Card>
      ) : (
        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line font-display text-[11px] font-extrabold uppercase tracking-wider text-navy/50">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-center">Sacchi</th>
                  <th className="px-4 py-3">Capi extra</th>
                  <th className="px-4 py-3 text-right">Compenso capi</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((o) => {
                  const suoi = capiPerOrdine.get(o.order_id) ?? [];
                  const capiCents = suoi.reduce((t, c) => t + c.comp_lav_cents * c.qty, 0);
                  return (
                    <tr key={o.order_id} className="border-b border-line/60 last:border-0 align-top">
                      <td className="px-4 py-3 font-medium text-muted">{fmtDate(o.created_at)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/laundry/${o.order_id}`} className="font-display font-bold text-blue hover:underline">
                          {o.client_code ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-display font-extrabold text-navy">{sacchiDi(o)}</span>
                        {o.bags_arrivati == null && (
                          <span className="block text-[11px] font-semibold text-[#C9881F]">non contati</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {suoi.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {suoi.map((c) => (
                              <li key={c.id} className="font-medium text-navy">
                                {c.qty}× {c.item_name}
                                <span className="ml-1 text-xs text-muted">{eur(c.comp_lav_cents * c.qty)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-display font-bold text-navy">
                        {capiCents > 0 ? eur(capiCents) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 text-xs font-medium text-muted">
        Gli importi dei capi sono i compensi a te, IVA esclusa, come da listino. Se un numero non ti torna
        scrivici citando la data e il codice cliente: da qui si risale all&apos;ordine.
      </p>
    </>
  );
}

function Riquadro({ valore, etichetta, tono }: { valore: string; etichetta: string; tono?: "attesa" }) {
  return (
    <div className={`rounded-[16px] border p-4 ${tono === "attesa" ? "border-[#C9881F]/35 bg-[#C9881F]/8" : "border-line bg-white"}`}>
      <div className={`font-display text-2xl font-black ${tono === "attesa" ? "text-[#C9881F]" : "text-navy"}`}>{valore}</div>
      <div className="mt-0.5 text-xs font-semibold text-muted">{etichetta}</div>
    </div>
  );
}
