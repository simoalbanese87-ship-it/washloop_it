import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { BottoneInvio } from "@/components/ui/BottoneInvio";
import { AnnullaAddebito } from "@/components/admin/AnnullaAddebito";
import { createServiceClient } from "@/lib/supabase/server";
import { addebitaCapoSpeciale, correggiPrezzoCapo } from "@/lib/actions/charge";
import { fmtFull } from "@/lib/format";

export const dynamic = "force-dynamic";

/** I capi extra, prima che diventino soldi.
 *
 *  Perché serve una pagina sola
 *  ----------------------------
 *  Un capo speciale vive sparso in tre schede: quella del ritiro, quella del
 *  cliente e il portale della lavanderia. Per sapere «cosa sto per addebitare
 *  oggi» bisognava aprirle una per una, e infatti la camicia di fabia è rimasta
 *  in sospeso per giorni senza che nessuno la vedesse. Qui stanno tutte
 *  insieme, con accanto le due cose che servono a decidere: **quanto** e **da
 *  dove viene quel numero**.
 *
 *  Il controllo del prezzo
 *  -----------------------
 *  Ogni capo porta con sé una fotografia dei prezzi del momento in cui è stato
 *  registrato. È giusto — così un addebito comunicato non cambia sotto i piedi
 *  del cliente — ma vuol dire che se il listino cambia dopo, la fotografia
 *  resta vecchia e non lo dice a nessuno. È successo con la camicia: registrata
 *  a 3,00 € di compenso quando il contratto dice 2,05.
 *
 *  Qui il confronto è fatto e messo in faccia: se il prezzo congelato è diverso
 *  da quello a listino, la riga lo segnala **prima** che si prema addebita. */

type Riga = {
  id: string;
  order_id: string;
  item_name: string;
  qty: number;
  qty_totale: number | null;
  qty_inclusa: number | null;
  price_cli_cents: number;
  comp_lav_cents: number;
  created_at: string;
  autore: { full_name: string | null; role: string } | null;
  orders: {
    customer_id: string | null;
    status: string;
    profiles: { full_name: string | null; client_code: string | null; is_test: boolean } | null;
  } | null;
};
type Listino = { name: string; price_cli_cents: number; comp_lav_cents: number };

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export default async function ExtraDaAddebitare({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string }>;
}) {
  const { ok, warn } = await searchParams;
  const svc = createServiceClient();

  const [{ data: righe }, { data: listino }] = await Promise.all([
    svc
      .from("order_specials")
      .select(
        "id, order_id, item_name, qty, qty_totale, qty_inclusa, price_cli_cents, comp_lav_cents, created_at, " +
          "autore:profiles!order_specials_added_by_fkey(full_name, role), " +
          "orders(customer_id, status, profiles!orders_customer_id_fkey(full_name, client_code, is_test))",
      )
      .is("charged_at", null)
      .is("refunded_at", null)
      .is("annullato_at", null)
      .order("created_at", { ascending: false })
      .returns<Riga[]>(),
    svc.from("special_items").select("name, price_cli_cents, comp_lav_cents").returns<Listino[]>(),
  ]);

  const aListino = new Map((listino ?? []).map((l) => [l.name, l]));
  // I capi dei profili di prova non sono lavoro da fare: sporcherebbero
  // l'elenco delle cose che stanno per diventare soldi veri.
  const tutte = (righe ?? []).filter((r) => !uno(uno(r.orders)?.profiles)?.is_test);

  const conProblema = tutte.filter((r) => {
    const l = aListino.get(r.item_name);
    return !l || l.price_cli_cents !== r.price_cli_cents || l.comp_lav_cents !== r.comp_lav_cents;
  });
  const totale = tutte.reduce((t, r) => t + r.price_cli_cents * r.qty, 0);

  return (
    <>
      <PageTitle
        kicker="Finanza"
        title="Extra da addebitare"
        sub={`${tutte.length} ${tutte.length === 1 ? "capo registrato e non ancora messo in fattura" : "capi registrati e non ancora messi in fattura"} · ${eur(totale)}`}
      />

      {ok && <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <Card className="mb-4">
        <p className="text-sm font-medium text-muted">
          Ogni capo porta con sé il <strong className="text-navy">prezzo del momento in cui è stato
          registrato</strong>: è giusto, così un importo comunicato al cliente non cambia sotto i suoi
          piedi. Ma se il listino cambia dopo, quella fotografia resta vecchia e non lo dice a nessuno —
          è successo con la camicia. Qui il confronto è fatto: le righe fuori listino sono marcate, e
          conviene sistemarle <strong className="text-navy">prima</strong> di addebitare.
        </p>
        {conProblema.length > 0 && (
          <p className="mt-2 rounded-[12px] bg-[#C9881F]/12 px-3 py-2 text-sm font-semibold text-[#C9881F]">
            {conProblema.length} {conProblema.length === 1 ? "riga ha un prezzo diverso" : "righe hanno un prezzo diverso"} da
            quello a listino. Il listino si cambia da{" "}
            <Link href="/admin/listino" className="underline">Impostazioni → Listino</Link>; il prezzo già
            congelato su una riga si corregge togliendola e rifacendola dalla scheda del ritiro.
          </p>
        )}
      </Card>

      {tutte.length === 0 ? (
        <Card>
          <p className="text-sm font-medium text-muted">
            Nessun capo in attesa: tutto quello che la lavanderia ha registrato è già in fattura, oppure è
            stato annullato.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tutte.map((r) => {
            const ordine = uno(r.orders);
            const cliente = uno(ordine?.profiles);
            const l = aListino.get(r.item_name);
            const prezzoDiverso = !!l && l.price_cli_cents !== r.price_cli_cents;
            const compDiverso = !!l && l.comp_lav_cents !== r.comp_lav_cents;
            const a = uno(r.autore);
            const chi =
              a?.role === "partner" ? "dalla lavanderia" :
              a?.role === "admin" ? "dal pannello" :
              a?.role === "courier" ? "dal rider" : null;

            return (
              <Card key={r.id} className={prezzoDiverso || compDiverso || !l ? "!border-[#C9881F]/45" : ""}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-base font-extrabold text-navy">
                    {r.qty}× {r.item_name}
                    {r.qty_totale != null && (
                      <span className="ml-2 text-xs font-medium text-muted">
                        ({r.qty_totale} trovate, {r.qty_inclusa ?? 0} comprese)
                      </span>
                    )}
                  </span>
                  <span className="font-display text-lg font-black text-navy">{eur(r.price_cli_cents * r.qty)}</span>
                </div>

                <div className="mt-1 text-sm font-medium text-muted">
                  {cliente?.full_name ? (
                    <Link href={`/admin/abbonati/${ordine?.customer_id}`} className="font-bold text-blue hover:underline">
                      {cliente.full_name}
                    </Link>
                  ) : "Cliente"}
                  {cliente?.client_code ? ` · ${cliente.client_code}` : ""} ·{" "}
                  <Link href={`/admin/ordini/${r.order_id}`} className="font-bold text-blue hover:underline">
                    vedi il ritiro →
                  </Link>
                </div>

                <div className="mt-1 text-xs font-medium text-muted">
                  registrato {chi ?? "da qualcuno non più risalibile"}
                  {a?.full_name ? ` (${a.full_name})` : ""} · {fmtFull(r.created_at)}
                </div>

                {/* Il confronto con il listino, che è la ragione per cui questa
                    pagina esiste: si guarda prima di premere, non dopo. E i due
                    numeri si correggono qui, finché nessuno ha pagato niente:
                    prima l'unico modo era togliere il capo e rifarlo. */}
                <form action={correggiPrezzoCapo} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <input type="hidden" name="special_id" value={r.id} />
                  <input type="hidden" name="torna_a" value="/admin/extra" />
                  <label className={`block rounded-[12px] px-3 py-2 text-xs font-bold ${prezzoDiverso ? "bg-[#C9881F]/12 text-[#C9881F]" : "bg-ice text-muted"}`}>
                    Al cliente (IVA inclusa)
                    {prezzoDiverso && <span className="ml-1 normal-case">· a listino ora {eur(l!.price_cli_cents)}</span>}
                    <input
                      name="price_cli_eur"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      defaultValue={(r.price_cli_cents / 100).toFixed(2)}
                      className="mt-1 h-10 w-full rounded-[10px] border border-line bg-white px-3 font-display text-base font-extrabold text-navy outline-none focus:border-blue"
                    />
                  </label>
                  <label className={`block rounded-[12px] px-3 py-2 text-xs font-bold ${compDiverso ? "bg-[#C9881F]/12 text-[#C9881F]" : "bg-ice text-muted"}`}>
                    Alla lavanderia (imponibile)
                    {compDiverso && <span className="ml-1 normal-case">· a listino ora {eur(l!.comp_lav_cents)}</span>}
                    <input
                      name="comp_lav_eur"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      defaultValue={(r.comp_lav_cents / 100).toFixed(2)}
                      className="mt-1 h-10 w-full rounded-[10px] border border-line bg-white px-3 font-display text-base font-extrabold text-navy outline-none focus:border-blue"
                    />
                  </label>
                  <BottoneInvio className="h-10 rounded-full border-2 border-navy px-4 font-display text-sm font-extrabold text-navy">
                    Correggi i prezzi
                  </BottoneInvio>
                </form>

                {!l && (
                  <p className="mt-2 rounded-[12px] bg-[#C0392B]/8 px-3 py-2 text-xs font-semibold text-[#C0392B]">
                    Questo capo non è più a listino: controlla il prezzo prima di addebitarlo.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <form action={addebitaCapoSpeciale}>
                    <input type="hidden" name="special_id" value={r.id} />
                    <input type="hidden" name="torna_a" value="/admin/extra" />
                    <BottoneInvio className="rounded-full bg-blue px-5 py-2 font-display text-sm font-extrabold text-white">
                      Addebita {eur(r.price_cli_cents * r.qty)}
                    </BottoneInvio>
                  </form>
                  <AnnullaAddebito specialId={r.id} tornaA="/admin/extra" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs font-medium text-muted">
        «Addebita» crea la voce su Stripe: non preleva subito, entra nella prossima fattura
        dell&apos;abbonamento. Da lì in poi si toglie solo con un rimborso.
      </p>
    </>
  );
}
