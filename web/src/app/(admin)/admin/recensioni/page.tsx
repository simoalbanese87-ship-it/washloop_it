import { Card, PageTitle } from "@/components/app/AppShell";
import { BottoneInvio } from "@/components/ui/BottoneInvio";
import { createServiceClient } from "@/lib/supabase/server";
import { candidatiRecensione } from "@/lib/candidati-recensione";
import { anteprimaInvito, mandaCopiaDiProva, mandaInvito } from "@/lib/actions/recensioni";

export const dynamic = "force-dynamic";

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
  const { daInvitare, invitati } = await candidatiRecensione(svc);

  // L'anteprima si guarda con un cliente vero, numeri compresi: è la riga che
  // dice «nove sacchi» quella che può venire storta, e con un nome finto non
  // la si vedrebbe mai.
  const esempio = daInvitare[0];
  const html = await anteprimaInvito(
    esempio?.nome ?? "Fabia Marconi",
    esempio?.storia ?? { sacchi: 9, meseDiPartenza: "settembre" },
    "https://washloop.it/api/email/unsubscribe?t=anteprima",
  );

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
        <form action={mandaCopiaDiProva} className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              name="a"
              required
              placeholder="a chi mandarla"
              className="h-10 min-w-[16rem] flex-1 rounded-[12px] border-2 border-line bg-white px-3 text-sm font-semibold text-navy"
            />
            <input
              type="email"
              name="cc"
              placeholder="in copia (facoltativo)"
              className="h-10 min-w-[14rem] flex-1 rounded-[12px] border-2 border-line bg-white px-3 text-sm font-semibold text-navy"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="font-display text-xs font-bold text-navy/55">con i numeri di</label>
            <select
              name="dati"
              defaultValue={esempio?.id ?? ""}
              className="h-10 rounded-[12px] border-2 border-line bg-white px-2 text-sm font-semibold text-navy"
            >
              {[...daInvitare, ...invitati].map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome ?? "Cliente"} · {c.consegne} {c.consegne === 1 ? "sacco" : "sacchi"}
                </option>
              ))}
            </select>
            <BottoneInvio
              attesa="Mando…"
              className="ml-auto rounded-full bg-navy px-4 py-2 font-display text-xs font-extrabold text-cyan"
            >
              Manda la prova
            </BottoneInvio>
          </div>
        </form>
        <p className="mt-2 text-xs font-medium text-muted">
          La prova non segna nessuno come invitato: chi la riceve resta nell&apos;elenco qui sotto. Porta in cima una
          fascia gialla che dice che è una prova, e l&apos;oggetto lo ripete. L&apos;indirizzo deve essere già nostro —
          un cliente o un lead — altrimenti non c&apos;è un link di disiscrizione da metterci.
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
                <span className="font-display text-sm font-extrabold text-navy">{r.nome ?? "Cliente"}</span>
                <span className="rounded-full bg-white px-2.5 py-1 font-display text-xs font-bold text-navy">
                  {r.codice ?? "—"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 font-display text-xs font-bold ${
                    r.abbonamentoVivo ? "bg-[#1F8A5B]/15 text-[#1F8A5B]" : "bg-[#C0392B]/12 text-[#C0392B]"
                  }`}
                >
                  {r.abbonamentoVivo ? "Abbonamento attivo" : "Abbonamento chiuso"}
                </span>
                <span className="text-xs font-medium text-muted">
                  {r.consegne} {r.consegne === 1 ? "consegna" : "consegne"} · ultima {giorno(r.ultimaConsegna)}
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
                <span className="font-display text-sm font-extrabold text-navy">{r.nome ?? "Cliente"}</span>
                <span className="text-xs font-medium text-muted">
                  invitato il {giorno(r.chiestaAt)} · {r.consegne}{" "}
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
