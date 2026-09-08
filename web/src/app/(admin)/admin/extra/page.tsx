import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { BottoneInvio } from "@/components/ui/BottoneInvio";
import { AnnullaAddebito } from "@/components/admin/AnnullaAddebito";
import { LinkOfferta } from "@/components/admin/LinkOfferta";
import { createServiceClient } from "@/lib/supabase/server";
import { addebitaSubitoCapo, correggiPrezzoCapo, stornaCapoSpeciale } from "@/lib/actions/charge";
import { fmtFull } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Il registro dei capi extra: cosa è stato incassato, cosa no, cosa è stato tolto.
 *
 *  Perché è cambiata
 *  -----------------
 *  Nasceva come elenco dei capi in attesa di addebito. Ma da quando l'incasso
 *  parte da solo quando la lavanderia segna il sacco pronto, di capi in attesa
 *  non ce ne sono più: la pagina sarebbe rimasta vuota per sempre.
 *
 *  Quello che serve adesso è un altro mestiere: **il posto dove si va quando un
 *  cliente reclama**, e quello dove si vede subito se un prelievo non è
 *  riuscito. Prima quell'informazione non esisteva da nessuna parte — un capo
 *  con `charged_at` valorizzato risultava «fatto» che i soldi fossero arrivati
 *  o no, ed è per questo che le camicie di Giulia sono rimaste per giorni con
 *  zero euro incassati senza che nessuno se ne accorgesse.
 *
 *  In cima i non riusciti, perché sono l'unica cosa su cui agire oggi. Sotto il
 *  registro, con il confronto col listino: nessuno guarda più il prezzo prima
 *  che parta, quindi almeno lo si deve poter vedere dopo. */

type Riga = {
  id: string;
  order_id: string;
  item_name: string;
  qty: number;
  price_cli_cents: number;
  comp_lav_cents: number;
  created_at: string;
  charged_at: string | null;
  incassato_at: string | null;
  incasso_fallito_at: string | null;
  incasso_errore: string | null;
  link_pagamento: string | null;
  refunded_at: string | null;
  annullato_at: string | null;
  annullato_motivo: string | null;
  orders: {
    customer_id: string | null;
    profiles: { full_name: string | null; client_code: string | null; is_test: boolean } | null;
  } | null;
};
type Listino = { name: string; price_cli_cents: number; comp_lav_cents: number };

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export default async function RegistroExtra({
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
        "id, order_id, item_name, qty, price_cli_cents, comp_lav_cents, created_at, charged_at, " +
          "incassato_at, incasso_fallito_at, incasso_errore, link_pagamento, refunded_at, annullato_at, annullato_motivo, " +
          "orders(customer_id, profiles!orders_customer_id_fkey(full_name, client_code, is_test))",
      )
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<Riga[]>(),
    svc.from("special_items").select("name, price_cli_cents, comp_lav_cents").returns<Listino[]>(),
  ]);

  const aListino = new Map((listino ?? []).map((l) => [l.name, l]));
  const tutte = (righe ?? []).filter((r) => !uno(uno(r.orders)?.profiles)?.is_test);

  const nonRiusciti = tutte.filter((r) => r.incasso_fallito_at && !r.refunded_at && !r.annullato_at);
  const inAttesa = tutte.filter((r) => !r.charged_at && !r.refunded_at && !r.annullato_at);
  const chiusi = tutte.filter((r) => r.refunded_at || r.annullato_at);
  const chiusiOk = (r: Riga) => !r.incasso_fallito_at && !r.refunded_at && !r.annullato_at;
  const incassati = tutte.filter((r) => r.incassato_at && chiusiOk(r));
  // Chiesti a Stripe ma senza conferma che i soldi siano arrivati: sono le voci
  // in coda per un rinnovo, come le camicie di Giulia. Non sono incassi e non
  // sono errori — sono soldi promessi, ed è la categoria che prima non esisteva.
  const daConfermare = tutte.filter((r) => r.charged_at && !r.incassato_at && chiusiOk(r));

  const totIncassato = incassati.reduce((t, r) => t + r.price_cli_cents * r.qty, 0);
  const totDaConfermare = daConfermare.reduce((t, r) => t + r.price_cli_cents * r.qty, 0);
  const totNonRiuscito = nonRiusciti.reduce((t, r) => t + r.price_cli_cents * r.qty, 0);

  return (
    <>
      <PageTitle
        kicker="Finanza"
        title="Capi extra"
        sub={`${eur(totIncassato)} incassati${totDaConfermare > 0 ? ` · ${eur(totDaConfermare)} chiesti e non ancora arrivati` : ""}${totNonRiuscito > 0 ? ` · ${eur(totNonRiuscito)} non riusciti` : ""}`}
      />

      {ok && <div className="mb-4 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] border border-[#C9881F]/35 bg-[#C9881F]/10 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <Card className="mb-4">
        <p className="text-sm font-medium text-muted">
          I capi si incassano <strong className="text-navy">quando la lavanderia segna il sacco pronto</strong>,
          in un unico prelievo per ritiro. Se la carta rifiuta, la fattura resta aperta con il suo link:
          l&apos;importo non è perso, va mandato al cliente. Il prezzo di ogni capo è quello del momento in
          cui è stato registrato — qui accanto trovi quello a listino oggi, per accorgerti se è andato fuori.
        </p>
      </Card>

      {/* Prima cosa in pagina: i soldi che non sono entrati. È l'unica riga su
          cui si può agire oggi, e prima non compariva da nessuna parte. */}
      {nonRiusciti.length > 0 && (
        <div className="mb-5 rounded-[16px] border-2 border-[#C0392B]/40 bg-[#C0392B]/[0.05] p-4">
          <span className="font-display text-base font-black text-[#C0392B]">
            {eur(totNonRiuscito)} non incassati · {nonRiusciti.length} {nonRiusciti.length === 1 ? "capo" : "capi"}
          </span>
          <p className="mt-1 text-sm font-medium text-navy/75">
            Il prelievo è stato rifiutato. La fattura resta aperta: manda al cliente il link qui sotto,
            oppure riprova.
          </p>
          <div className="mt-3 space-y-3">
            {nonRiusciti.map((r) => {
              const cliente = uno(uno(r.orders)?.profiles);
              return (
                <div key={r.id} className="rounded-[12px] bg-white p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-sm font-bold text-navy">
                      {r.qty}× {r.item_name} ·{" "}
                      <Link href={`/admin/abbonati/${uno(r.orders)?.customer_id}`} className="text-blue hover:underline">
                        {cliente?.full_name ?? "Cliente"}
                      </Link>
                    </span>
                    <span className="font-display text-sm font-black text-[#C0392B]">{eur(r.price_cli_cents * r.qty)}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#C0392B]">{r.incasso_errore}</p>
                  {r.link_pagamento && <LinkOfferta url={r.link_pagamento} />}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <form action={addebitaSubitoCapo}>
                      <input type="hidden" name="special_id" value={r.id} />
                      <input type="hidden" name="torna_a" value="/admin/extra" />
                      <BottoneInvio attesa="Prelievo…" className="rounded-full bg-blue px-4 py-1.5 font-display text-xs font-extrabold text-white">
                        Riprova il prelievo
                      </BottoneInvio>
                    </form>
                    <form action={stornaCapoSpeciale}>
                      <input type="hidden" name="special_id" value={r.id} />
                      <input type="hidden" name="torna_a" value="/admin/extra" />
                      <BottoneInvio className="font-display text-xs font-bold text-[#C0392B] hover:underline">
                        Storna
                      </BottoneInvio>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {inAttesa.length > 0 && (
        <div className="mb-5 rounded-[16px] border-2 border-[#2b7fd4]/35 bg-[#2b7fd4]/[0.06] p-4">
          <span className="font-display text-base font-black text-blue">
            {inAttesa.length} {inAttesa.length === 1 ? "capo ancora da incassare" : "capi ancora da incassare"}
          </span>
          <p className="mt-1 text-sm font-medium text-navy/75">
            Registrati ma non ancora chiesti al cliente: succede sui ritiri già segnati pronti prima di
            questa modifica, o su un capo aggiunto a mano dopo. Controlla il prezzo e incassa.
          </p>
          <div className="mt-3 space-y-3">
            {inAttesa.map((r) => (
              <div key={r.id} className="rounded-[12px] bg-white p-3">
                <Voce r={r} l={aListino.get(r.item_name)} modificabile />
              </div>
            ))}
          </div>
        </div>
      )}

      {daConfermare.length > 0 && (
        <div className="mb-5 rounded-[16px] border-2 border-[#C9881F]/45 bg-[#C9881F]/[0.08] p-4">
          <span className="font-display text-base font-black text-[#C9881F]">
            {eur(totDaConfermare)} chiesti, non ancora arrivati
          </span>
          <p className="mt-1 text-sm font-medium text-navy/75">
            Voci in coda per la prossima fattura dell&apos;abbonamento: diventano soldi solo se quel
            rinnovo arriva. <strong>Incassa adesso</strong> le tira fuori dalla coda e le preleva subito.
          </p>
          <div className="mt-3 space-y-3">
            {daConfermare.map((r) => (
              <div key={r.id} className="rounded-[12px] bg-white p-3">
                <Voce r={r} l={aListino.get(r.item_name)} incassabile />
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="!p-0">
        <div className="border-b border-line px-4 py-3 font-display text-sm font-extrabold text-navy">
          Registro · {incassati.length} {incassati.length === 1 ? "capo incassato" : "capi incassati"}
        </div>
        {incassati.length === 0 ? (
          <p className="px-4 py-4 text-sm font-medium text-muted">Nessun capo incassato finora.</p>
        ) : (
          <div className="divide-y divide-line/60">
            {incassati.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <Voce r={r} l={aListino.get(r.item_name)} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {chiusi.length > 0 && (
        <Card className="mt-4">
          <span className="font-display text-sm font-extrabold text-navy">Stornati e annullati</span>
          <ul className="mt-2 space-y-1.5">
            {chiusi.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-ice px-3 py-2 text-sm">
                <span className="font-semibold text-navy/70">
                  <span className="line-through">{r.qty}× {r.item_name}</span>
                  <span className="ml-2 text-xs font-medium text-muted">
                    {uno(uno(r.orders)?.profiles)?.full_name ?? "Cliente"}
                    {r.annullato_motivo ? ` · ${r.annullato_motivo}` : r.refunded_at ? " · rimborsato" : ""}
                  </span>
                </span>
                <span className="font-display text-sm font-bold text-muted line-through">{eur(r.price_cli_cents * r.qty)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

/** Una voce del registro: chi, quanto, quando, e se il prezzo è ancora quello
 *  del listino. I due prezzi si correggono solo finché non è stato chiesto
 *  niente — dopo, l'unica strada onesta è lo storno. */
function Voce({ r, l, modificabile, incassabile }: { r: Riga; l?: Listino; modificabile?: boolean; incassabile?: boolean }) {
  const cliente = uno(uno(r.orders)?.profiles);
  const prezzoDiverso = !!l && l.price_cli_cents !== r.price_cli_cents;
  const compDiverso = !!l && l.comp_lav_cents !== r.comp_lav_cents;
  const campo = "mt-1 h-9 w-24 rounded-[10px] border border-line bg-white px-2 font-display text-sm font-extrabold text-navy outline-none focus:border-blue";

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-sm font-bold text-navy">
          {r.qty}× {r.item_name} ·{" "}
          <Link href={`/admin/abbonati/${uno(r.orders)?.customer_id}`} className="text-blue hover:underline">
            {cliente?.full_name ?? "Cliente"}
          </Link>
          {cliente?.client_code ? <span className="ml-1 text-xs font-medium text-muted">{cliente.client_code}</span> : null}
        </span>
        <span className="font-display text-sm font-black text-navy">{eur(r.price_cli_cents * r.qty)}</span>
      </div>

      <div className="mt-0.5 text-xs font-medium text-muted">
        {r.incassato_at ? (
          <span className="font-bold text-[#1F8A5B]">incassato il {fmtFull(r.incassato_at)}</span>
        ) : r.charged_at ? (
          <span className="font-bold text-[#C9881F]">chiesto il {fmtFull(r.charged_at)}, incasso non ancora confermato</span>
        ) : (
          <>registrato il {fmtFull(r.created_at)}</>
        )}
        {" · "}
        <Link href={`/admin/ordini/${r.order_id}`} className="font-bold text-blue hover:underline">vedi il ritiro →</Link>
        {(prezzoDiverso || compDiverso) && (
          <span className="ml-2 rounded-full bg-[#C9881F]/15 px-2 py-0.5 font-bold text-[#C9881F]">
            fuori listino: oggi {l ? eur(l.price_cli_cents) : "—"} al cliente, {l ? eur(l.comp_lav_cents) : "—"} alla lavanderia
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {modificabile ? (
          <>
            <form action={correggiPrezzoCapo} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="special_id" value={r.id} />
              <input type="hidden" name="torna_a" value="/admin/extra" />
              <label className="text-[11px] font-bold text-muted">
                Cliente €
                <input name="price_cli_eur" type="number" step="0.01" min="0" required defaultValue={(r.price_cli_cents / 100).toFixed(2)} className={campo} />
              </label>
              <label className="text-[11px] font-bold text-muted">
                Lavanderia €
                <input name="comp_lav_eur" type="number" step="0.01" min="0" required defaultValue={(r.comp_lav_cents / 100).toFixed(2)} className={campo} />
              </label>
              <BottoneInvio className="h-9 rounded-full border-2 border-navy px-3 font-display text-xs font-extrabold text-navy">
                Correggi
              </BottoneInvio>
            </form>
            <form action={addebitaSubitoCapo}>
              <input type="hidden" name="special_id" value={r.id} />
              <input type="hidden" name="torna_a" value="/admin/extra" />
              <BottoneInvio attesa="Prelievo…" className="rounded-full bg-blue px-4 py-1.5 font-display text-xs font-extrabold text-white">
                Incassa {eur(r.price_cli_cents * r.qty)}
              </BottoneInvio>
            </form>
            <AnnullaAddebito specialId={r.id} tornaA="/admin/extra" />
          </>
        ) : (
          <>
            {/* Il bottone sta qui, dove si guarda. Prima per incassare una voce
                in coda bisognava sapere di doverla cercare nella scheda del
                cliente — e per arrivarci bisognava sapere quale cliente. */}
            {incassabile && (
              <form action={addebitaSubitoCapo}>
                <input type="hidden" name="special_id" value={r.id} />
                <input type="hidden" name="torna_a" value="/admin/extra" />
                <BottoneInvio attesa="Prelievo…" className="rounded-full bg-blue px-4 py-1.5 font-display text-xs font-extrabold text-white">
                  Incassa adesso {eur(r.price_cli_cents * r.qty)}
                </BottoneInvio>
              </form>
            )}
            <form action={stornaCapoSpeciale}>
              <input type="hidden" name="special_id" value={r.id} />
              <input type="hidden" name="torna_a" value="/admin/extra" />
              <BottoneInvio className="font-display text-xs font-bold text-[#C0392B] hover:underline">
                Storna
              </BottoneInvio>
            </form>
          </>
        )}
      </div>
    </>
  );
}
