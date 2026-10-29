import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { Fisarmonica } from "@/components/ui/Fisarmonica";
import { createServiceClient } from "@/lib/supabase/server";
import { scorpora } from "@/lib/iva";
import { coperturaDelCanone } from "@/lib/copertura-canone";
import { eRicavoDiCompetenza } from "@/lib/categoria-addebito";
import { escludiDaCompetenza, rimettiInCompetenza } from "@/lib/actions/competenza";
import { BottoneInvio } from "@/components/ui/BottoneInvio";
import { sacchiInLavorazione } from "@/lib/sacchi-in-lavorazione";
import {
  lunediDi,
  meseDi,
  settimaneDelMese,
  contoDelMese,
  totaliPerSettimana,
  ricaviDi,
  costiDi,
  type AddebitoConto,
  type CanoneStorico,
  type PrevistoConto,
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
  manual: boolean | null;
  custom_price_cents: number | null;
  created_at: string;
  activated_at: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean | null;
  cancel_at: string | null;
  current_period_end: string | null;
  prova_fine_at: string | null;
  termina_dopo_settimane: number | null;
  plans: { price_month_cents: number } | { price_month_cents: number }[] | null;
  profiles:
    | { full_name: string | null; is_test: boolean; competenza_escluso_at: string | null; competenza_escluso_motivo: string | null }
    | { full_name: string | null; is_test: boolean; competenza_escluso_at: string | null; competenza_escluso_motivo: string | null }[]
    | null;
};
type Ordine = {
  id: string;
  customer_id: string | null;
  status: string;
  bags: number | null;
  bags_arrivati: number | null;
  created_at: string;
  laundry_id: string | null;
  laundries: { bag_comp_cents: number | null } | { bag_comp_cents: number | null }[] | null;
  pickup: { starts_at: string } | { starts_at: string }[] | null;
  profiles: { is_test: boolean } | { is_test: boolean }[] | null;
};
type Payout = { order_id: string | null; amount_cents: number; kind: string; servizio_il: string; orders: { customer_id: string | null } | { customer_id: string | null }[] | null };
type Addebito = { customer_id: string; amount_cents: number; created_at: string; description: string; kind: string; status: string; categoria: string | null };
type Extra = {
  qty: number;
  price_cli_cents: number;
  item_name: string;
  orders: { customer_id: string | null; created_at: string; pickup: { starts_at: string } | { starts_at: string }[] | null } | null;
};

export default async function Competenza({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string | string[]; prova?: string | string[]; ok?: string; warn?: string }>;
}) {
  const sp = await searchParams;
  const grezzo = Array.isArray(sp.mese) ? sp.mese[0] : sp.mese;
  const mese = /^\d{4}-\d{2}$/.test(grezzo ?? "") ? grezzo! : meseOggi();
  const includiProva = (Array.isArray(sp.prova) ? sp.prova[0] : sp.prova) === "1";
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const warn = typeof sp.warn === "string" ? sp.warn : null;

  const svc = createServiceClient();
  const [a, m] = mese.split("-").map(Number);
  const dal = new Date(Date.UTC(a, m - 1, 1)).toISOString();
  const al = new Date(Date.UTC(a, m, 1)).toISOString();

  const [{ data: fasce }, { data: subs }, { data: ordini }, { data: payouts }, { data: extra }, { data: addebiti }] = await Promise.all([
    // Le settimane del mese: quelle in cui c'è una fascia di ritiro aperta. Una
    // fascia archiviata non è una settimana di servizio e non deve dividere il
    // canone — è il motivo per cui il venerdì tolto a ottobre non crea colonne.
    svc.from("slots").select("starts_at").eq("kind", "pickup").is("archived_at", null).gte("starts_at", dal).lt("starts_at", al)
      .returns<{ starts_at: string }[]>(),
    svc.from("subscriptions").select("user_id, status, manual, custom_price_cents, created_at, activated_at, canceled_at, cancel_at_period_end, cancel_at, current_period_end, prova_fine_at, termina_dopo_settimane, plans(price_month_cents), profiles(full_name, is_test, competenza_escluso_at, competenza_escluso_motivo)")
      .order("created_at", { ascending: true }).returns<Sub[]>(),
    svc.from("orders").select("id, customer_id, status, bags, bags_arrivati, created_at, laundry_id, laundries(bag_comp_cents), pickup:slots!orders_pickup_slot_id_fkey(starts_at), profiles!orders_customer_id_fkey(is_test)")
      .neq("status", "cancelled").returns<Ordine[]>(),
    // `servizio_il` è già la presa in carico, riallineata dalla migration 0083:
    // non si ricalcola la data una seconda volta con regole proprie.
    svc.from("laundry_payouts").select("order_id, amount_cents, kind, servizio_il, orders(customer_id)").neq("status", "void")
      .returns<Payout[]>(),
    svc.from("order_specials").select("qty, price_cli_cents, item_name, orders(customer_id, created_at, pickup:slots!orders_pickup_slot_id_fkey(starts_at))")
      .not("charged_at", "is", null).is("refunded_at", null).is("annullato_at", null).returns<Extra[]>(),
    // Gli addebiti fatti a mano dal pannello: un sacco in più, una lavorazione
    // fuori listino, una modifica concordata. Non passano dagli ordini, e
    // finora non comparivano da nessuna parte in questo conto — quel cliente
    // sembrava rendere meno di quanto rendeva.
    //
    // Si prendono tutti e si classificano qui, con `categoria-addebito.ts`.
    //
    // Prima il filtro era `kind = 'charge'`, con la convinzione che ogni
    // `refund` fosse lo storno di un capo. Due errori in uno: il conguaglio di
    // un cambio piano è un `charge` e passava — contato sopra il canone che
    // questa pagina già spalma — e gli incassi a sacco, che scrivono
    // `kind = 'sacco'`, non sarebbero mai entrati.
    svc.from("customer_charges").select("customer_id, amount_cents, created_at, description, kind, status, categoria")
      .neq("status", "void").returns<Addebito[]>(),
  ]);

  const settimane = settimaneDelMese((fasce ?? []).map((f) => f.starts_at), mese);

  // Lo storico dei canoni: più righe per cliente quando ha cambiato piano, così
  // una settimana prima del cambio vale il prezzo di allora.
  // Quanti incassi risultano registrati per ciascun cliente. Serve ai soli
  // abbonamenti **manuali**: lì «attivo» lo scrive una persona che preme
  // «Conferma pagamento», e non è la stessa cosa che i soldi siano arrivati.
  const { data: incassiRighe } = await svc
    .from("invoices")
    .select("user_id")
    .returns<{ user_id: string | null }[]>();
  const incassiDi = new Map<string, number>();
  for (const i of incassiRighe ?? []) {
    if (i.user_id) incassiDi.set(i.user_id, (incassiDi.get(i.user_id) ?? 0) + 1);
  }

  const canoni: CanoneStorico[] = [];
  const nomi = new Map<string, string>();
  // Chi è stato tolto dal conto a mano, con il suo motivo: resta visibile in
  // fondo alla pagina, non sparisce.
  const esclusi = new Map<string, string>();
  const nomiEsclusi = new Map<string, string>();
  const adesso = new Date().toISOString();
  for (const s of subs ?? []) {
    const prof = uno(s.profiles);
    if (!includiProva && prof?.is_test) continue;
    if (prof?.competenza_escluso_at) {
      esclusi.set(s.user_id, prof.competenza_escluso_motivo ?? "senza motivo");
      // Il nome serve comunque, per poterlo nominare nel blocco in fondo.
      nomiEsclusi.set(s.user_id, prof.full_name ?? "Cliente");
      continue;
    }
    const piano = uno(s.plans);
    // Da quando a quando quell'abbonamento copre, con tutte le distinzioni che
    // non stanno in una riga: prova gratuita, disdetta chiesta contro disdetta
    // avvenuta, checkout mai pagato. Sta in `copertura-canone.ts`, che ha i
    // test — da quando la quota matura anche senza ritiri, un abbonamento
    // contato male diventa un ricavo che non esiste.
    const copertura = coperturaDelCanone(
      {
        ...s,
        prezzoPianoCents: piano?.price_month_cents ?? null,
        incassiRegistrati: incassiDi.get(s.user_id) ?? 0,
      },
      adesso,
    );
    nomi.set(s.user_id, prof?.full_name ?? "Cliente");
    if (copertura) canoni.push(copertura);
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

  // ---- Il costo dei sacchi ritirati e non ancora riconsegnati --------------
  //
  // La riga vera in `laundry_payouts` nasce alla riconsegna, il ricavo matura
  // alla presa in carico: finché i sacchi sono in lavanderia la settimana in
  // corso si leggeva tutta margine — 222,90 € di ricavi e 9,02 € di costo, il 7
  // ottobre, con sei sacchi già ritirati.
  //
  // Il calcolo sta in `sacchi-in-lavorazione.ts` e lo usa anche la Home: erano
  // due pagine che rispondevano alla stessa domanda con numeri diversi, e
  // finché la funzione è una sola non possono più divergere.
  const previsti: PrevistoConto[] = (await sacchiInLavorazione(svc, { includiProva }))
    .filter((p) => meseDi(p.giorno) === mese)
    .map((p) => ({ clienteId: p.clienteId, settimana: lunediDi(p.giorno), cents: p.cents }));

  const addebitiConto: AddebitoConto[] = (addebiti ?? [])
    .filter((a) => nomi.has(a.customer_id))
    // Chi è un ricavo lo dice `categoria-addebito.ts`, che risponde anche per
    // la Home e per il dettaglio delle metriche: una regola sola, o il
    // conguaglio sparisce da una pagina e resta nell'altra.
    .filter(eRicavoDiCompetenza)
    .map((a) => ({ clienteId: a.customer_id, settimana: lunediDi(a.created_at), cents: a.amount_cents }));

  const righe = contoDelMese({
    clienti: [...nomi.entries()].map(([clienteId, nome]) => ({ clienteId, nome })),
    settimane,
    canoni,
    ordini: ordiniConto,
    payouts: payoutConto,
    extra: extraConto.map((x) => ({ clienteId: x.clienteId!, settimana: lunediDi(x.quando!), prezzoCents: x.cents })),
    addebiti: addebitiConto,
    previsti,
  });

  const colonne = totaliPerSettimana(righe, settimane);
  const totaleMese = righe.reduce(
    (t, r) => ({
      ricavi: t.ricavi + ricaviDi(r.totale),
      costi: t.costi + costiDi(r.totale),
      canone: t.canone + r.totale.ricavoCanoneCents,
      extra: t.extra + r.totale.ricavoExtraCents,
      addebiti: t.addebiti + r.totale.ricavoAddebitiCents,
      sacco: t.sacco + r.totale.costoSaccoCents,
      capi: t.capi + r.totale.costoExtraCents,
      previsti: t.previsti + r.totale.costoSaccoPrevistoCents,
    }),
    { ricavi: 0, costi: 0, canone: 0, extra: 0, addebiti: 0, sacco: 0, capi: 0, previsti: 0 },
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

      {ok && <div className="mb-4 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] bg-[#C9881F]/12 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

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
          cinque ritiri vale cinque settimane, e ciascuna vale meno — e matura in{" "}
          <strong className="text-navy">tutte le settimane coperte dall&apos;abbonamento</strong>, anche in quelle senza
          ritiri: il cliente ha comprato il servizio, che lo usi o no. Rimborsi e conguagli di un cambio piano restano
          fuori dai ricavi, perché quei soldi il canone li conta già. I ricavi sono IVA inclusa, il costo della
          lavanderia è imponibile: il guadagno si calcola sul <strong className="text-navy">netto</strong>.
        </p>
        <p className="mt-2 text-sm font-medium text-muted">
          Il costo del sacco si imputa alla settimana del ritiro, anche se la riconsegna non c&apos;è ancora stata:
          finché i sacchi sono in lavanderia è segnato{" "}
          <strong className="text-[#C9881F]">in lavorazione</strong>. Alla consegna diventa una riga vera nel dovuto
          alla lavanderia, e l&apos;importo non cambia. Si pagano i sacchi <strong className="text-navy">registrati</strong>:
          se la lavanderia ne conta due, due si pagano, anche su un piano da uno.
        </p>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Riquadro label="Ricavi (IVA incl.)" valore={eur(totaleMese.ricavi)} sub={`${eur(totaleMese.canone)} canoni · ${eur(totaleMese.extra)} capi · ${eur(totaleMese.addebiti)} addebiti`} />
        <Riquadro label="Ricavi netti" valore={eur(nettoMese)} sub="scorporata l'IVA al 22%" />
        <Riquadro
          label="Costo lavanderia"
          valore={eur(totaleMese.costi)}
          sub={`${eur(totaleMese.sacco + totaleMese.previsti)} sacchi · ${eur(totaleMese.capi)} capi${totaleMese.previsti ? ` · di cui ${eur(totaleMese.previsti)} ancora in lavorazione` : ""}`}
        />
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
            dettaglio={(c) => `canone ${eur(c.ricavoCanoneCents)} · capi ${eur(c.ricavoExtraCents)} · addebiti ${eur(c.ricavoAddebitiCents)}`}
            totali={colonne.map(ricaviDi)}
          />
          <Blocco
            titolo="Costi lavanderia"
            settimane={settimane}
            righe={righe}
            valore={(c) => costiDi(c)}
            dettaglio={(c) =>
              `sacchi ${eur(c.costoSaccoCents + c.costoSaccoPrevistoCents)}${c.costoSaccoPrevistoCents ? ` (${eur(c.costoSaccoPrevistoCents)} da registrare)` : ""} · capi ${eur(c.costoExtraCents)}`
            }
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
                        <th className="py-2 pr-3 text-right">Capi</th>
                        <th className="py-2 pr-3 text-right">Addebiti</th>
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
                            <td className="py-2 pr-3 text-right text-navy">{c.ricavoAddebitiCents ? eur(c.ricavoAddebitiCents) : "—"}</td>
                            <td className="py-2 pr-3 text-right text-muted">
                              {c.costoSaccoCents + c.costoSaccoPrevistoCents ? eur(c.costoSaccoCents + c.costoSaccoPrevistoCents) : "—"}
                              {c.costoSaccoPrevistoCents > 0 && (
                                <span className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[#C9881F]">in lavorazione</span>
                              )}
                            </td>
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

      {/* Chi sta fuori dal conto, e perché.
          Un cliente tolto di nascosto è un buco nel totale; tolto e scritto è
          una decisione. Qui si vede chi è fuori, per quale ragione, e si
          rimette dentro con un clic. */}
      <Card className="mt-6">
        <h2 className="font-display text-sm font-extrabold text-navy">Fuori dal conto</h2>
        {esclusi.size === 0 ? (
          <p className="mt-1 text-sm font-medium text-muted">
            Nessuno: tutti i clienti entrano nei numeri qui sopra.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {[...esclusi.entries()].map(([id, motivo]) => (
              <li key={id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line/60 pb-2 text-sm last:border-0">
                <span>
                  <Link href={`/admin/abbonati/${id}`} className="font-semibold text-navy hover:underline">
                    {nomiEsclusi.get(id) ?? "Cliente"}
                  </Link>
                  <span className="ml-2 font-medium text-muted">{motivo}</span>
                </span>
                <form action={rimettiInCompetenza}>
                  <input type="hidden" name="cliente_id" value={id} />
                  <input type="hidden" name="back" value={`/admin/competenza?mese=${mese}`} />
                  <BottoneInvio attesa="Rimetto…" className="font-display text-xs font-bold text-blue hover:underline">
                    Rimetti nel conto
                  </BottoneInvio>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={escludiDaCompetenza} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="back" value={`/admin/competenza?mese=${mese}`} />
          <select
            name="cliente_id"
            aria-label="Chi togliere dal conto"
            className="h-9 max-w-[220px] rounded-[10px] border border-line bg-white px-2 text-sm font-semibold text-navy"
          >
            <option value="">Chi togliere…</option>
            {[...nomi.entries()].map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
          <input
            name="motivo"
            placeholder="Perché (es. mai pagato, da stralciare)"
            maxLength={300}
            className="h-9 w-[280px] max-w-full rounded-[10px] border border-line bg-white px-3 text-sm font-medium text-navy"
          />
          <BottoneInvio attesa="Tolgo…" className="rounded-full border-2 border-navy/20 px-3.5 py-1.5 font-display text-xs font-bold text-navy">
            Togli dal conto
          </BottoneInvio>
        </form>
        <p className="mt-2 text-[11px] font-medium text-muted">
          Non cancella niente: il cliente resta con i suoi ordini e i suoi incassi, e smette solo di contare in
          questa pagina. Il motivo serve a te fra sei mesi.
        </p>
      </Card>
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
