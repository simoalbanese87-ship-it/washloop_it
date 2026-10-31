import { Card, PageTitle } from "@/components/app/AppShell";
import { BottoneInvio } from "@/components/ui/BottoneInvio";
import { createServiceClient } from "@/lib/supabase/server";
import { abbonamentoVivo } from "@/lib/puo-prenotare";
import { anteprimaInvito, mandaCopiaDiProva, mandaInvito } from "@/lib/actions/recensioni";

export const dynamic = "force-dynamic";

type Profilo = {
  id: string;
  full_name: string | null;
  client_code: string | null;
  is_test: boolean | null;
  recensione_chiesta_at: string | null;
};

type Ordine = { customer_id: string | null; status: string; delivery_slot_id: string | null };
type Abbonamento = { user_id: string; status: string; cancel_at: string | null };

/** Chi ha un abbonamento ancora in piedi.
 *
 *  Due campi, non uno: `cancel_at` è la data in cui l'abbonamento finisce, e
 *  fino a quel giorno lo stato su Stripe resta `active`. Guardarne uno solo fa
 *  risultare attivo chi ha già disdetto.
 *
 *  Chi ha due abbonamenti — uno chiuso e uno nuovo — è un cliente attivo, non
 *  un cliente perso: basta che uno dei due sia vivo.
 *
 *  Sta fuori dal componente perché legge l'ora, e una pagina che legge l'ora
 *  mentre disegna non è pura. */
function chiHaUnAbbonamentoVivo(abbonamenti: Abbonamento[], ora = Date.now()): Set<string> {
  const vivi = new Set<string>();
  for (const s of abbonamenti) {
    const scaduto = s.cancel_at != null && Date.parse(s.cancel_at) <= ora;
    if (abbonamentoVivo(s.status) && !scaduto) vivi.add(s.user_id);
  }
  return vivi;
}

const giorno = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

/** Admin → Recensioni: chi ha ricevuto l'invito, e chi l'automatismo non può
 *  più raggiungere.
 *
 *  Perché questa pagina esiste
 *  ---------------------------
 *  L'invito a recensire parte da solo dentro l'email «Consegnato», alla
 *  **prima** riconsegna e una volta sola per persona. È la regola giusta — più
 *  avanti si chiederebbe a freddo, a ogni consegna non si otterrebbe più
 *  niente — ma ha un effetto collaterale: chi era già cliente prima che
 *  l'automatismo esistesse ha la prima consegna alle spalle, e non gli verrà
 *  chiesto mai.
 *
 *  Sono poche persone, si contano a mano, e l'email va mandata guardando in
 *  faccia chi la riceve: a chi se n'è andato dopo un sacco solo non si chiede
 *  una recensione, gli si chiede perché se n'è andato. Per questo qui non c'è
 *  nessun «manda a tutti»: un pulsante per riga, e la riga dice chi è.
 *
 *  L'anteprima è l'email vera, costruita dalla stessa funzione che la spedisce:
 *  un'anteprima ricostruita a parte prima o poi mostra una cosa diversa da
 *  quella che parte. */
export default async function RecensioniPage() {
  const svc = createServiceClient();

  const [{ data: profili }, { data: ordini }, { data: abbonamenti }] = await Promise.all([
    svc.from("profiles").select("id, full_name, client_code, is_test, recensione_chiesta_at").returns<Profilo[]>(),
    svc.from("orders").select("customer_id, status, delivery_slot_id").returns<Ordine[]>(),
    svc.from("subscriptions").select("user_id, status, cancel_at").returns<Abbonamento[]>(),
  ]);

  const consegne = new Map<string, number>();
  const fasceDaLeggere = new Map<string, string[]>();
  for (const o of ordini ?? []) {
    if (!o.customer_id || !["delivered", "completed"].includes(o.status)) continue;
    consegne.set(o.customer_id, (consegne.get(o.customer_id) ?? 0) + 1);
    if (o.delivery_slot_id) {
      fasceDaLeggere.set(o.customer_id, [...(fasceDaLeggere.get(o.customer_id) ?? []), o.delivery_slot_id]);
    }
  }

  const idFasce = [...new Set([...fasceDaLeggere.values()].flat())];
  const { data: fasce } = idFasce.length
    ? await svc.from("slots").select("id, starts_at").in("id", idFasce).returns<{ id: string; starts_at: string }[]>()
    : { data: [] as { id: string; starts_at: string }[] };
  const quando = new Map((fasce ?? []).map((f) => [f.id, f.starts_at]));

  const vivo = chiHaUnAbbonamentoVivo(abbonamenti ?? []);

  const righe = (profili ?? [])
    .filter((p) => !p.is_test && (consegne.get(p.id) ?? 0) > 0)
    .map((p) => {
      const date = (fasceDaLeggere.get(p.id) ?? []).map((id) => quando.get(id)).filter((d): d is string => !!d);
      const ultima = date.sort().at(-1) ?? null;
      return {
        ...p,
        consegne: consegne.get(p.id) ?? 0,
        ultima,
        attivo: vivo.has(p.id),
      };
    })
    .sort((a, b) => (b.ultima ?? "").localeCompare(a.ultima ?? ""));

  const daInvitare = righe.filter((r) => !r.recensione_chiesta_at);
  const invitati = righe.filter((r) => r.recensione_chiesta_at);

  // L'anteprima si guarda con un nome vero, non con «Mario Rossi»: il saluto è
  // la prima riga che si legge, ed è l'unica cosa che cambia da persona a
  // persona.
  const esempio = daInvitare[0]?.full_name ?? "Fabia Marconi";
  const html = await anteprimaInvito(esempio, "https://washloop.it/api/email/unsubscribe?t=anteprima");

  const configurata = !!process.env.GOOGLE_REVIEW_URL?.trim();

  return (
    <>
      <PageTitle
        kicker="Marketing"
        title="Recensioni Google"
        sub={`${invitati.length} invitati dall'automatismo · ${daInvitare.length} che non raggiungerà mai`}
      />

      {!configurata && (
        <Card className="mb-4 border-[#C9881F]/40 bg-[#C9881F]/5">
          <p className="text-sm font-semibold text-[#C9881F]">
            Manca <code>GOOGLE_REVIEW_URL</code>: senza il link l&apos;email partirebbe senza il bottone, quindi da qui
            non parte niente.
          </p>
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="font-display text-lg font-extrabold text-navy">Come funziona da sola</h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-muted">
          L&apos;invito viaggia dentro l&apos;email «Consegnato», alla <strong>prima</strong>{" "}
          riconsegna e una volta sola per persona. Il momento è quello giusto: il bucato è appena tornato e l&apos;impressione è fresca.
          Chiederlo più tardi vuol dire chiederlo a freddo; chiederlo a ogni consegna vuol dire non ottenerlo più.
        </p>
        <p className="mt-3 text-sm font-medium leading-relaxed text-muted">
          Chi è qui sotto senza invito era già cliente prima che l&apos;automatismo esistesse: la sua prima consegna è
          passata, e da sola l&apos;email non gli arriverà mai. Si manda a mano, guardando chi è: a chi se n&apos;è
          andato dopo un sacco solo conviene chiedere perché, non una recensione.
        </p>
      </Card>

      <Card className="mb-4">
        <h2 className="font-display text-lg font-extrabold text-navy">L&apos;email, com&apos;è fatta</h2>
        <p className="mt-2 text-sm font-medium text-muted">
          È l&apos;email vera, costruita dalla stessa funzione che la spedisce. Il saluto usa il nome di chi la riceve.
        </p>
        <iframe
          title="Anteprima dell'invito"
          srcDoc={html}
          className="mt-4 h-[620px] w-full rounded-[18px] border border-line bg-[#EEF3F9]"
        />
        <form action={mandaCopiaDiProva} className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="email"
            name="a"
            required
            placeholder="indirizzo per la copia di prova"
            className="h-10 min-w-[16rem] flex-1 rounded-[12px] border-2 border-line bg-white px-3 text-sm font-semibold text-navy"
          />
          <BottoneInvio
            attesa="Mando…"
            className="rounded-full bg-navy px-4 py-2 font-display text-xs font-extrabold text-cyan"
          >
            Mandami una copia
          </BottoneInvio>
        </form>
        <p className="mt-2 text-xs font-medium text-muted">
          La copia di prova non segna nessuno come invitato. L&apos;indirizzo deve essere già nostro — un cliente o un
          lead — altrimenti non c&apos;è un link di disiscrizione da metterci.
        </p>
      </Card>

      <Card className="mb-4">
        <h2 className="font-display text-lg font-extrabold text-navy">Mai invitati ({daInvitare.length})</h2>
        {daInvitare.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-muted">Nessuno: l&apos;automatismo li ha raggiunti tutti.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {daInvitare.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-[16px] border border-line bg-ice px-4 py-3"
              >
                <span className="font-display text-sm font-extrabold text-navy">{r.full_name ?? "Cliente"}</span>
                <span className="rounded-full bg-white px-2.5 py-1 font-display text-xs font-bold text-navy">
                  {r.client_code ?? "—"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 font-display text-xs font-bold ${
                    r.attivo ? "bg-[#1F8A5B]/15 text-[#1F8A5B]" : "bg-[#C0392B]/12 text-[#C0392B]"
                  }`}
                >
                  {r.attivo ? "Abbonamento attivo" : "Abbonamento chiuso"}
                </span>
                <span className="text-xs font-medium text-muted">
                  {r.consegne} {r.consegne === 1 ? "consegna" : "consegne"} · ultima {giorno(r.ultima)}
                </span>
                <form action={mandaInvito} className="ml-auto">
                  <input type="hidden" name="id" value={r.id} />
                  <BottoneInvio
                    attesa="Mando…"
                    className="rounded-full bg-gradient-to-br from-blue to-cyan px-3.5 py-1.5 font-display text-[11px] font-extrabold text-white"
                  >
                    Manda l&apos;invito
                  </BottoneInvio>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-extrabold text-navy">Già invitati ({invitati.length})</h2>
        {invitati.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-muted">Ancora nessuno.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {invitati.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-1 py-1.5">
                <span className="font-display text-sm font-extrabold text-navy">{r.full_name ?? "Cliente"}</span>
                <span className="text-xs font-medium text-muted">
                  invitato il {giorno(r.recensione_chiesta_at)} · {r.consegne}{" "}
                  {r.consegne === 1 ? "consegna" : "consegne"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
