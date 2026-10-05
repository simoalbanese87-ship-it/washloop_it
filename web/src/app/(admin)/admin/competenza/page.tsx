import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { Fisarmonica } from "@/components/ui/Fisarmonica";
import { createServiceClient } from "@/lib/supabase/server";
import { scorpora } from "@/lib/iva";
import {
  lunediDi,
  meseDi,
  settimaneDelMese,
  contoDelMese,
  totaliPerSettimana,
  ricaviDi,
  costiDi,
  type CanoneStorico,
  type Cella,
  type RigaCliente,
  type Settimana,
} from "@/lib/conto-settimanale";

export const dynamic = "force-dynamic";

/** Il conto economico della settimana, cliente per cliente.
 *
 *  La Home dice quanto è **incassato**: il numero che serve per sapere se si
 *  può pagare la lavanderia. Qui si risponde a un'altra domanda — su quel
 *  cliente, quella settimana, ci abbiamo guadagnato? — e per rispondere
 *  servono tre cose che prima stavano in tre posti: il canone imputato alla
 *  settimana, i capi extra, e il costo della lavanderia **separato fra sacco e
 *  capi**.
 *
 *  Il canone si divide per le settimane di servizio del mese e non per i ritiri
 *  del cliente: se il mese ha cinque martedì ogni settimana vale meno, ed è il
 *  punto che la versione precedente sbagliava. La regola, con i suoi test, sta
 *  in `conto-settimanale.ts`.
 *
 *  I numeri qui **non** coincidono con quelli della Home, e non devono: sono
 *  due letture diverse degli stessi fatti. */

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

const meseOggi = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);

const etichettaMese = (mese: string) => {
  const [a, m] = mese.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
};

/** «lun 1 set»: la colonna deve stare in poche lettere. */
const etichettaSettimana = (lunedi: Settimana) =>
  new Date(`${lunedi}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });

const meseVicino = (mese: string, passo: number) => {
  const [a, m] = mese.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + passo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

type Sub = {
  user_id: string;
  status: string;
  custom_price_cents: number | null;
  created_at: string;
  termina_dopo_settimane: number | null;
  plans: { price_month_cents: number } | { price_month_cents: number }[] | null;
  profiles: { full_name: string | null; is_test: boolean } | { full_name: string | null; is_test: boolean }[] | null;
};
type Ordine = {
  id: string;
  customer_id: string | null;
  bags: number | null;
  bags_arrivati: number | null;
  created_at: string;
  pickup: { starts_at: string } | { starts_at: string }[] | null;
  profiles: { is_test: boolean } | { is_test: boolean }[] | null;
};
type Payout = { amount_cents: number; kind: string; servizio_il: string; orders: { customer_id: string | null } | { customer_id: string | null }[] | null };
type Extra = {
  qty: number;
  price_cli_cents: number;
  item_name: string;
  orders: { customer_id: string | null; created_at: string; pickup: { starts_at: string } | { starts_at: string }[] | null } | null;
};

export default async function Competenza({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string | string[]; prova?: string | string[] }>;
}) {
  const sp = await searchParams;
  const grezzo = Array.isArray(sp.mese) ? sp.mese[0] : sp.mese;
  const mese = /^\d{4}-\d{2}$/.test(grezzo ?? "") ? grezzo! : meseOggi();
  const includiProva = (Array.isArray(sp.prova) ? sp.prova[0] : sp.prova) === "1";

  const svc = createServiceClient();
  const [a, m] = mese.split("-").map(Number);
  const dal = new Date(Date.UTC(a, m - 1, 1)).toISOString();
  const al = new Date(Date.UTC(a, m, 1)).toISOString();

  const [{ data: fasce }, { data: subs }, { data: ordini }, { data: payouts }, { data: extra }] = await Promise.all([
    // Le settimane del mese: quelle in cui c'è una fascia di ritiro aperta. Una
    // fascia archiviata non è una settimana di servizio e non deve dividere il
    // canone — è il motivo per cui il venerdì tolto a ottobre non crea colonne.
    svc.from("slots").select("starts_at").eq("kind", "pickup").is("archived_at", null).gte("starts_at", dal).lt("starts_at", al)
      .returns<{ starts_at: string }[]>(),
    svc.from("subscriptions").select("user_id, status, custom_price_cents, created_at, termina_dopo_settimane, plans(price_month_cents), profiles(full_name, is_test)")
      .order("created_at", { ascending: true }).returns<Sub[]>(),
    svc.from("orders").select("id, customer_id, bags, bags_arrivati, created_at, pickup:slots!orders_pickup_slot_id_fkey(starts_at), profiles!orders_customer_id_fkey(is_test)")
      .neq("status", "cancelled").returns<Ordine[]>(),
    // `servizio_il` è già la presa in carico, riallineata dalla migration 0083:
    // non si ricalcola la data una seconda volta con regole proprie.
    svc.from("laundry_payouts").select("amount_cents, kind, servizio_il, orders(customer_id)").neq("status", "void")
      .returns<Payout[]>(),
    svc.from("order_specials").select("qty, price_cli_cents, item_name, orders(customer_id, created_at, pickup:slots!orders_pickup_slot_id_fkey(starts_at))")
      .not("charged_at", "is", null).is("refunded_at", null).is("annullato_at", null).returns<Extra[]>(),
  ]);

  const settimane = settimaneDelMese((fasce ?? []).map((f) => f.starts_at), mese);

  // Lo storico dei canoni: più righe per cliente quando ha cambiato piano, così
  // una settimana prima del cambio vale il prezzo di allora.
  const canoni: CanoneStorico[] = [];
  const nomi = new Map<string, string>();
  for (const s of subs ?? []) {
    const prof = uno(s.profiles);
    if (!includiProva && prof?.is_test) continue;
    const piano = uno(s.plans);
    canoni.push({
      clienteId: s.user_id,
      canoneCents: s.custom_price_cents ?? piano?.price_month_cents ?? 0,
      daIso: s.created_at,
      // Un pacchetto a termine copre le sue settimane, non un mese: 40 € per
      // una settimana valgono 40 € in quella settimana.
      settimaneCoperte: s.termina_dopo_settimane,
    });
    nomi.set(s.user_id, prof?.full_name ?? "Cliente");
  }

  const giornoOrdine = (o: Ordine) => uno(o.pickup)?.starts_at ?? o.created_at;
  const ordiniConto = (ordini ?? [])
    .filter((o) => o.customer_id && (includiProva || !uno(o.profiles)?.is_test))
    .filter((o) => meseDi(giornoOrdine(o)) === mese)
    .map((o) => ({ clienteId: o.customer_id!, settimana: lunediDi(giornoOrdine(o)), sacchi: o.bags_arrivati ?? o.bags ?? 1 }));

  const payoutConto = (payouts ?? [])
    .map((p) => ({ p, clienteId: uno(p.orders)?.customer_id ?? null }))
    .filter((x) => x.clienteId && nomi.has(x.clienteId))
    .map((x) => ({
      clienteId: x.clienteId!,
      settimana: lunediDi(`${x.p.servizio_il}T12:00:00Z`),
      kind: x.p.kind,
      amountCents: x.p.amount_cents,
    }));

  const extraConto = (extra ?? [])
    .map((e) => {
      const ord = e.orders;
      const quando = uno(ord?.pickup)?.starts_at ?? ord?.created_at ?? null;
      return { clienteId: ord?.customer_id ?? null, quando, cents: e.price_cli_cents * e.qty, nome: e.item_name, qty: e.qty };
    })
    .filter((x) => x.clienteId && x.quando);

  const righe = contoDelMese({
    clienti: [...nomi.entries()].map(([clienteId, nome]) => ({ clienteId, nome })),
    settimane,
    canoni,
    ordini: ordiniConto,
    payouts: payoutConto,
    extra: extraConto.map((x) => ({ clienteId: x.clienteId!, settimana: lunediDi(x.quando!), prezzoCents: x.cents })),
  });

  const colonne = totaliPerSettimana(righe, settimane);
  const totaleMese = righe.reduce(
    (t, r) => ({
      ricavi: t.ricavi + ricaviDi(r.totale),
      costi: t.costi + costiDi(r.totale),
      canone: t.canone + r.totale.ricavoCanoneCents,
      extra: t.extra + r.totale.ricavoExtraCents,
      sacco: t.sacco + r.totale.costoSaccoCents,
      capi: t.capi + r.totale.costoExtraCents,
    }),
    { ricavi: 0, costi: 0, canone: 0, extra: 0, sacco: 0, capi: 0 },
  );
  const nettoMese = scorpora(totaleMese.ricavi).imponibile;
  const guadagnoMese = nettoMese - totaleMese.costi;

  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ mese, prova: includiProva ? "1" : undefined, ...patch })) if (v) u.set(k, v);
    return u.toString() ? `?${u}` : "";
  };

  return (
    <>
      <PageTitle
        kicker="Competenza"
        title="Guadagno per settimana"
        sub={`${etichettaMese(mese)} · ${settimane.length} ${settimane.length === 1 ? "settimana di servizio" : "settimane di servizio"} · ${righe.length} ${righe.length === 1 ? "cliente" : "clienti"}`}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={`/admin/competenza${qs({ mese: meseVicino(mese, -1) })}`} className="rounded-full border border-line px-3 py-1.5 font-display text-sm font-bold text-navy hover:bg-ice">
              ← {etichettaMese(meseVicino(mese, -1))}
            </Link>
            <Link href={`/admin/competenza${qs({ mese: meseVicino(mese, 1) })}`} className="rounded-full border border-line px-3 py-1.5 font-display text-sm font-bold text-navy hover:bg-ice">
              {etichettaMese(meseVicino(mese, 1))} →
            </Link>
          </div>
          <Link href={`/admin/competenza${qs({ prova: includiProva ? undefined : "1" })}`} className="font-display text-xs font-bold text-navy/55 hover:text-navy">
            {includiProva ? "Nascondi dati di prova" : "Mostra dati di prova"}
          </Link>
        </div>
        <p className="mt-3 text-sm font-medium text-muted">
          Il canone si divide per le <strong className="text-navy">settimane di servizio del mese</strong> — un mese con
          cinque ritiri vale cinque settimane, e ciascuna vale meno — e matura solo nelle settimane in cui il cliente è
          stato servito davvero. I ricavi sono IVA inclusa, il costo della lavanderia è imponibile: il guadagno si
          calcola sul <strong className="text-navy">netto</strong>.
        </p>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Riquadro label="Ricavi (IVA incl.)" valore={eur(totaleMese.ricavi)} sub={`${eur(totaleMese.canone)} canoni · ${eur(totaleMese.extra)} extra`} />
        <Riquadro label="Ricavi netti" valore={eur(nettoMese)} sub="scorporata l'IVA al 22%" />
        <Riquadro label="Costo lavanderia" valore={eur(totaleMese.costi)} sub={`${eur(totaleMese.sacco)} sacchi · ${eur(totaleMese.capi)} capi`} />
        <Riquadro label="Guadagno" valore={eur(guadagnoMese)} sub="netto meno costo" tono={guadagnoMese >= 0 ? "bene" : "male"} />
      </div>

      {settimane.length === 0 ? (
        <Card>
          <p className="text-sm font-medium text-muted">
            In {etichettaMese(mese)} non c&apos;è nessuna fascia di ritiro aperta: senza settimane di servizio non c&apos;è
            niente da dividere. Le fasce si creano in Catalogo.
          </p>
        </Card>
      ) : (
        <>
          <Blocco
            titolo="Ricavi"
            settimane={settimane}
            righe={righe}
            valore={(c) => ricaviDi(c)}
            dettaglio={(c) => `canone ${eur(c.ricavoCanoneCents)} · extra ${eur(c.ricavoExtraCents)}`}
            totali={colonne.map(ricaviDi)}
          />
          <Blocco
            titolo="Costi lavanderia"
            settimane={settimane}
            righe={righe}
            valore={(c) => costiDi(c)}
            dettaglio={(c) => `sacchi ${eur(c.costoSaccoCents)} · capi ${eur(c.costoExtraCents)}`}
            totali={colonne.map(costiDi)}
          />

          <Card className="mt-4 !p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <tbody>
                  <tr className="font-display font-extrabold text-navy">
                    <td className="py-2 pr-3">Guadagno (netto − costi)</td>
                    {colonne.map((c, i) => {
                      const g = scorpora(ricaviDi(c)).imponibile - costiDi(c);
                      return (
                        <td key={settimane[i]} className={`py-2 pr-3 text-right ${g >= 0 ? "text-[#1F8A5B]" : "text-[#C0392B]"}`}>
                          {eur(g)}
                        </td>
                      );
                    })}
                    <td className={`py-2 text-right ${guadagnoMese >= 0 ? "text-[#1F8A5B]" : "text-[#C0392B]"}`}>{eur(guadagnoMese)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <h2 className="mt-6 font-display text-base font-extrabold text-navy">Dettaglio per cliente</h2>
          {righe.map((r) => {
            const netto = scorpora(ricaviDi(r.totale)).imponibile;
            const g = netto - costiDi(r.totale);
            return (
              <Fisarmonica
                key={r.clienteId}
                titolo={r.nome}
                conteggio={eur(g)}
                nota={`${r.totale.ritiri} ${r.totale.ritiri === 1 ? "ritiro" : "ritiri"} · ${eur(ricaviDi(r.totale))} incassabili · ${eur(costiDi(r.totale))} di costo`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
                        <th className="py-2 pr-3">Settimana</th>
                        <th className="py-2 pr-3 text-right">Ritiri</th>
                        <th className="py-2 pr-3 text-right">Sacchi</th>
                        <th className="py-2 pr-3 text-right">Canone</th>
                        <th className="py-2 pr-3 text-right">Extra</th>
                        <th className="py-2 pr-3 text-right">Costo sacchi</th>
                        <th className="py-2 pr-3 text-right">Costo capi</th>
                        <th className="py-2 text-right">Guadagno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settimane.map((s) => {
                        const c = r.celle[s];
                        if (!c) return null;
                        const gs = scorpora(ricaviDi(c)).imponibile - costiDi(c);
                        return (
                          <tr key={s} className="border-b border-line/60">
                            <td className="py-2 pr-3 font-semibold text-navy">{etichettaSettimana(s)}</td>
                            <td className="py-2 pr-3 text-right text-muted">{c.ritiri}</td>
                            <td className="py-2 pr-3 text-right text-muted">{c.sacchi}</td>
                            <td className="py-2 pr-3 text-right text-navy">{eur(c.ricavoCanoneCents)}</td>
                            <td className="py-2 pr-3 text-right text-navy">{c.ricavoExtraCents ? eur(c.ricavoExtraCents) : "—"}</td>
                            <td className="py-2 pr-3 text-right text-muted">{c.costoSaccoCents ? eur(c.costoSaccoCents) : "—"}</td>
                            <td className="py-2 pr-3 text-right text-muted">{c.costoExtraCents ? eur(c.costoExtraCents) : "—"}</td>
                            <td className={`py-2 text-right font-display font-extrabold ${gs >= 0 ? "text-[#1F8A5B]" : "text-[#C0392B]"}`}>{eur(gs)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Link href={`/admin/abbonati/${r.clienteId}`} className="mt-3 inline-flex font-display text-xs font-bold text-blue hover:underline">
                  Apri la scheda →
                </Link>
              </Fisarmonica>
            );
          })}
        </>
      )}
    </>
  );
}

function Riquadro({ label, valore, sub, tono }: { label: string; valore: string; sub: string; tono?: "bene" | "male" }) {
  const colore = tono === "bene" ? "text-[#1F8A5B]" : tono === "male" ? "text-[#C0392B]" : "text-navy";
  return (
    <Card className="!p-4">
      <div className={`font-display text-xl font-black ${colore}`}>{valore}</div>
      <div className="mt-0.5 font-display text-sm font-extrabold text-navy">{label}</div>
      <div className="text-xs font-medium text-muted">{sub}</div>
    </Card>
  );
}

/** Un blocco del foglio: una riga per cliente, una colonna per settimana.
 *  Le caselle vuote restano vuote — una settimana senza servizio non è uno zero. */
function Blocco({
  titolo,
  settimane,
  righe,
  valore,
  dettaglio,
  totali,
}: {
  titolo: string;
  settimane: Settimana[];
  righe: RigaCliente[];
  valore: (c: Cella) => number;
  /** Di cosa è fatta la cifra, per chi ci passa sopra il mouse. Un 47,40 € senza
   *  spiegazione è la domanda che poi arriva per messaggio. */
  dettaglio: (c: Cella) => string;
  totali: number[];
}) {
  const eurOpt = (n: number) => (n ? eur(n) : "—");
  const totale = totali.reduce((t, n) => t + n, 0);
  return (
    <Card className="mt-4 !p-4">
      <h2 className="font-display text-sm font-extrabold text-navy">{titolo}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
              <th className="py-2 pr-3">Cliente</th>
              {settimane.map((s) => (
                <th key={s} className="py-2 pr-3 text-right">{etichettaSettimana(s)}</th>
              ))}
              <th className="py-2 text-right">Totale</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.clienteId} className="border-b border-line/60">
                <td className="py-2 pr-3 font-semibold text-navy">{r.nome}</td>
                {settimane.map((s) => (
                  <td key={s} className="py-2 pr-3 text-right text-navy" title={r.celle[s] ? dettaglio(r.celle[s]) : undefined}>
                    {r.celle[s] ? eurOpt(valore(r.celle[s])) : ""}
                  </td>
                ))}
                <td className="py-2 text-right font-display font-extrabold text-navy" title={dettaglio(r.totale)}>{eurOpt(valore(r.totale))}</td>
              </tr>
            ))}
            <tr className="font-display font-extrabold text-navy">
              <td className="py-2 pr-3">Totale</td>
              {totali.map((n, i) => (
                <td key={settimane[i]} className="py-2 pr-3 text-right">{eurOpt(n)}</td>
              ))}
              <td className="py-2 text-right">{eurOpt(totale)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
