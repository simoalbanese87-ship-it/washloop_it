import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { createServiceClient } from "@/lib/supabase/server";
import {
  lunediDi,
  settimaneDiCompetenza,
  costoPrevistoCents,
  margineCents,
  type RitiroPerCompetenza,
  type CanoneCliente,
} from "@/lib/competenza";

export const dynamic = "force-dynamic";

/** Quanto vale una settimana di lavoro, non quanto è arrivato in banca.
 *
 *  Perché esiste, accanto alla Home
 *  --------------------------------
 *  La Home dice quanto è **incassato**: il numero che serve per sapere se si
 *  può pagare la lavanderia, e che non mente mai. Ma non dice se il servizio
 *  sta in piedi. Un canone incassato il 29 copre quattro settimane di ritiri, e
 *  un mese in cui nessuno ritira niente ha lo stesso identico incasso di uno
 *  pieno.
 *
 *  Qui il ricavo si attribuisce a quando il servizio è stato **reso**: il
 *  canone si divide per i ritiri fatti davvero, quindi due soli ritiri in un
 *  mese valgono ciascuno il doppio, e una settimana senza ritiri vale zero.
 *  Serve a vedere due cose che dalla cassa non si vedono: se il prezzo copre il
 *  costo, e le settimane in cui prendiamo soldi senza lavorare — che sono
 *  quelle in cui un cliente sta per accorgersi di pagare per niente.
 *
 *  I numeri qui **non** coincidono con quelli della Home, e non devono: sono
 *  due letture diverse degli stessi fatti. È anche il motivo per cui questa
 *  pagina sta per conto suo. */

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

const giornoRoma = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

const etichettaSettimana = (lunedi: string) => {
  const d = new Date(`${lunedi}T12:00:00Z`);
  const fine = new Date(d);
  fine.setUTCDate(fine.getUTCDate() + 6);
  const f = (x: Date) => `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${f(d)} – ${f(fine)}`;
};

export default async function Competenza() {
  const svc = createServiceClient();

  const [{ data: ordini }, { data: abbonamenti }, { data: capi }, { data: compensi }, { data: lavanderia }] =
    await Promise.all([
      svc
        .from("orders")
        .select(
          "id, customer_id, status, created_at, bags, bags_arrivati, " +
            "pickup:slots!orders_pickup_slot_id_fkey(starts_at), " +
            "profiles!orders_customer_id_fkey(is_test)",
        )
        .neq("status", "cancelled")
        .returns<{
          id: string;
          customer_id: string | null;
          status: string;
          created_at: string;
          bags: number | null;
          bags_arrivati: number | null;
          pickup: { starts_at: string } | null;
          profiles: { is_test: boolean } | null;
        }[]>(),
      svc
        .from("subscriptions")
        .select("user_id, status, custom_price_cents, bags_per_week, created_at, plans(price_month_cents, bags_per_week), profiles(full_name, is_test)")
        .order("created_at", { ascending: false })
        .returns<{
          user_id: string;
          status: string;
          custom_price_cents: number | null;
          bags_per_week: number | null;
          created_at: string;
          plans: { price_month_cents: number; bags_per_week: number } | null;
          profiles: { full_name: string | null; is_test: boolean } | null;
        }[]>(),
      // I capi che il cliente ha davvero pagato: niente storni, niente annulli,
      // e niente capi offerti — quelli sono un costo, non un ricavo.
      svc
        .from("order_specials")
        .select("qty, price_cli_cents, created_at, charged_at, refunded_at, annullato_at, orders(profiles!orders_customer_id_fkey(is_test))")
        .not("charged_at", "is", null)
        .is("refunded_at", null)
        .is("annullato_at", null)
        .returns<{
          qty: number;
          price_cli_cents: number;
          created_at: string;
          charged_at: string | null;
          refunded_at: string | null;
          annullato_at: string | null;
          orders: { profiles: { is_test: boolean } | null } | null;
        }[]>(),
      // Il costo vero: quello che dobbiamo alla lavanderia, capi offerti
      // compresi — su quelli il lavoro è stato fatto e lo paghiamo noi.
      svc
        .from("laundry_payouts")
        .select("amount_cents, kind, created_at, status, orders(created_at, pickup:slots!orders_pickup_slot_id_fkey(starts_at))")
        .neq("status", "void")
        .returns<{
          amount_cents: number;
          kind: string;
          created_at: string;
          status: string;
          orders: { created_at: string; pickup: { starts_at: string } | null } | null;
        }[]>(),
      svc.from("laundries").select("bag_comp_cents").eq("active", true).limit(1).maybeSingle<{ bag_comp_cents: number | null }>(),
    ]);

  const compensoSacco = lavanderia?.bag_comp_cents ?? 1230;

  // Un ritiro matura nella settimana in cui il sacco è stato preso: è quando il
  // servizio comincia. Senza fascia vale la data di creazione — meglio una
  // settimana approssimata che una riga che sparisce dal conto.
  const ritiri: RitiroPerCompetenza[] = (ordini ?? [])
    .filter((o) => !uno(o.profiles)?.is_test && o.customer_id)
    .map((o) => {
      const quando = uno(o.pickup)?.starts_at ?? o.created_at;
      return {
        clienteId: o.customer_id!,
        settimana: lunediDi(quando),
        mese: giornoRoma(quando).slice(0, 7),
        sacchi: o.bags_arrivati ?? o.bags ?? 1,
      };
    });

  // Un canone per cliente, il più recente. I sacchi previsti vengono
  // dall'accordo sull'abbonamento o, in mancanza, dal piano — e da nient'altro:
  // il ripiego sulla ricorrenza che il tetto operativo usa (scegliTetto) qui
  // non c'è di proposito, perché il «previsto» non deve poter essere un numero
  // che nessuno ha deciso. Chi non ce l'ha resta fuori invece di entrarci con
  // una cifra inventata.
  const visti = new Set<string>();
  const canoni: CanoneCliente[] = [];
  for (const s of abbonamenti ?? []) {
    if (visti.has(s.user_id)) continue;
    visti.add(s.user_id);
    if (uno(s.profiles)?.is_test) continue;
    if (!["active", "trialing"].includes(s.status)) continue;
    const piano = uno(s.plans);
    const canoneCents = s.custom_price_cents ?? piano?.price_month_cents ?? 0;
    const sacchiPrevisti =
      s.bags_per_week ?? (s.custom_price_cents != null ? null : piano?.bags_per_week ?? null);
    canoni.push({ clienteId: s.user_id, nome: uno(s.profiles)?.full_name ?? null, canoneCents, sacchiPrevisti });
  }

  const extraPerSettimana = new Map<string, number>();
  for (const c of capi ?? []) {
    if (uno(uno(c.orders)?.profiles)?.is_test) continue;
    const k = lunediDi(c.charged_at ?? c.created_at);
    extraPerSettimana.set(k, (extraPerSettimana.get(k) ?? 0) + c.price_cli_cents * c.qty);
  }

  const costoPerSettimana = new Map<string, number>();
  for (const p of compensi ?? []) {
    const o = uno(p.orders);
    // Il costo matura con il ritiro a cui si riferisce, non con la data in cui
    // la riga è stata scritta: il compenso a sacco si registra alla riconsegna,
    // giorni dopo, e finirebbe nella settimana sbagliata.
    const quando = uno(o?.pickup)?.starts_at ?? o?.created_at ?? p.created_at;
    const k = lunediDi(quando);
    costoPerSettimana.set(k, (costoPerSettimana.get(k) ?? 0) + p.amount_cents);
  }

  const settimane = settimaneDiCompetenza(ritiri, canoni, extraPerSettimana, costoPerSettimana).slice(0, 12);
  const previsto = costoPrevistoCents(canoni, compensoSacco);

  const totRicavo = settimane.reduce((t, s) => t + s.ricavoCanoneCents + s.ricavoExtraCents, 0);
  const totCosto = settimane.reduce((t, s) => t + s.costoCents, 0);
  const totMargine = settimane.reduce((t, s) => t + margineCents(s), 0);

  return (
    <>
      <PageTitle
        kicker="Finanza"
        title="Competenza settimanale"
        sub={`${settimane.length} settimane · quanto vale il lavoro fatto, non quanto è arrivato in banca`}
      />

      <Card className="mb-4">
        <p className="text-sm font-medium text-muted">
          Qui il ricavo si conta <strong className="text-navy">quando il servizio è stato reso</strong>: il
          canone si divide per i ritiri fatti davvero, quindi due soli ritiri in un mese valgono ciascuno il
          doppio, e una settimana senza ritiri vale zero. I numeri{" "}
          <strong className="text-navy">non coincidono</strong> con{" "}
          <Link href="/admin" className="text-blue hover:underline">Soldi del mese</Link>, che dice quanto è
          arrivato su Stripe: sono due letture diverse degli stessi fatti, e servono a rispondere a due
          domande diverse.
        </p>
        <p className="mt-2 text-xs font-medium text-muted">
          Ricavi IVA inclusa, costo lavanderia imponibile. Il margine sottrae il costo dall&apos;imponibile
          del ricavo, non dal lordo.
        </p>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Riquadro valore={eur(totRicavo)} etichetta="ricavo maturato" />
        <Riquadro valore={eur(totCosto)} etichetta="costo lavanderia" />
        <Riquadro valore={eur(totMargine)} etichetta="margine" tono={totMargine < 0 ? "male" : "bene"} />
        <Riquadro
          valore={previsto.conSacchi > 0 ? eur(previsto.cents) : "—"}
          etichetta="costo previsto a settimana"
          nota={
            previsto.senzaSacchi > 0
              ? `su ${previsto.conSacchi} ${previsto.conSacchi === 1 ? "cliente" : "clienti"} su ${previsto.conSacchi + previsto.senzaSacchi}`
              : undefined
          }
        />
      </div>

      {previsto.senzaSacchi > 0 && (
        <Card className="mb-4 !border-[#C9881F]/35 !bg-[#C9881F]/[0.07]">
          <p className="text-sm font-semibold text-[#C9881F]">
            {previsto.senzaSacchi} {previsto.senzaSacchi === 1 ? "abbonamento non ha" : "abbonamenti non hanno"} un
            numero di sacchi a settimana.
          </p>
          <p className="mt-1 text-sm font-medium text-navy/75">
            Il «costo previsto» {previsto.senzaSacchi === 1 ? "lo lascia" : "li lascia"} fuori invece di inventare
            una cifra: se {previsto.senzaSacchi === 1 ? "lo contasse" : "li contasse"} con un numero a caso, il
            confronto con l&apos;effettivo direbbe quello che vogliamo sentirci dire. Il numero si scrive nella
            scheda del cliente, sotto «Abbonamento».
          </p>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {previsto.mancanti.map((m) => (
              <Link
                key={m.clienteId}
                href={`/admin/abbonati/${m.clienteId}`}
                className="font-display text-sm font-extrabold text-[#C9881F] underline"
              >
                {m.nome ?? "Senza nome"} →
              </Link>
            ))}
          </p>
        </Card>
      )}

      {settimane.length === 0 ? (
        <Card>
          <p className="text-sm font-medium text-muted">Nessun ritiro registrato: non c&apos;è ancora niente da attribuire.</p>
        </Card>
      ) : (
        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line font-display text-[11px] font-extrabold uppercase tracking-wider text-navy/50">
                  <th className="px-4 py-3">Settimana</th>
                  <th className="px-4 py-3 text-center">Ritiri</th>
                  <th className="px-4 py-3 text-center">Sacchi</th>
                  <th className="px-4 py-3 text-right">Abbonamento</th>
                  <th className="px-4 py-3 text-right">Extra</th>
                  <th className="px-4 py-3 text-right">Costo lavanderia</th>
                  <th className="px-4 py-3 text-right">Margine</th>
                </tr>
              </thead>
              <tbody>
                {settimane.map((s) => {
                  const m = margineCents(s);
                  const scostamento = previsto.conSacchi > 0 ? s.costoCents - previsto.cents : null;
                  return (
                    <tr key={s.settimana} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3 font-display font-bold text-navy">{etichettaSettimana(s.settimana)}</td>
                      <td className="px-4 py-3 text-center font-medium text-muted">{s.ritiri}</td>
                      <td className="px-4 py-3 text-center font-medium text-muted">{s.sacchi}</td>
                      <td className="px-4 py-3 text-right font-medium text-navy">{eur(s.ricavoCanoneCents)}</td>
                      <td className="px-4 py-3 text-right font-medium text-navy">
                        {s.ricavoExtraCents > 0 ? eur(s.ricavoExtraCents) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-navy">{eur(s.costoCents)}</span>
                        {scostamento != null && s.ritiri > 0 && (
                          <span className={`block text-[11px] font-semibold ${scostamento > 0 ? "text-[#C9881F]" : "text-muted"}`}>
                            {scostamento > 0 ? `${eur(scostamento)} sopra il previsto` : `${eur(-scostamento)} sotto`}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-display font-extrabold ${m < 0 ? "text-[#C0392B]" : "text-[#1F8A5B]"}`}>
                        {eur(m)}
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
        Una settimana con ricavo e senza ritiri vuol dire che abbiamo preso soldi senza lavorare: succede
        quando un cliente salta il ritiro, e prima o poi se ne accorge. Una con margine negativo vuol dire
        che quel servizio ci è costato più di quanto lo abbiamo venduto.
      </p>
    </>
  );
}

function Riquadro({ valore, etichetta, nota, tono }: { valore: string; etichetta: string; nota?: string; tono?: "bene" | "male" }) {
  const colore = tono === "male" ? "text-[#C0392B]" : tono === "bene" ? "text-[#1F8A5B]" : "text-navy";
  return (
    <div className="rounded-[16px] border border-line bg-white p-4">
      <div className={`font-display text-2xl font-black ${colore}`}>{valore}</div>
      <div className="mt-0.5 text-xs font-semibold text-muted">{etichetta}</div>
      {nota && <div className="text-[11px] font-medium text-muted">{nota}</div>}
    </div>
  );
}
