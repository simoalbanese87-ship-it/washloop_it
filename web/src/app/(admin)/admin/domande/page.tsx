import { createServiceClient } from "@/lib/supabase/server";
import { Card, PageTitle } from "@/components/app/AppShell";

export const dynamic = "force-dynamic";

/** Cosa chiede la gente all'assistente, e dove tace.
 *
 *  Serve a una cosa sola: sapere quali FAQ mancano. L'elenco in cima è quello
 *  che conta — le domande a cui l'assistente ha risposto «non lo so» — perché
 *  ognuna è una risposta che oggi qualcuno di noi dà a voce, e che potrebbe
 *  darsi da sola.
 *
 *  Nessun dato di chi ha scritto: la tabella non contiene IP, sessioni o
 *  numeri. Il testo però lo ha scritto una persona vera, quindi può contenere
 *  qualunque cosa: la pagina sta sotto il layout admin, e non si esporta. */

type Riga = {
  id: string;
  created_at: string;
  canale: string;
  domanda: string;
  risposta: string | null;
  non_lo_so: boolean;
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export default async function DomandeAssistente() {
  const svc = createServiceClient();
  const { data } = await svc
    .from("domande_assistente")
    .select("id, created_at, canale, domanda, risposta, non_lo_so")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<Riga[]>();

  const righe = data ?? [];
  const senzaRisposta = righe.filter((r) => r.non_lo_so);
  // L'istante si prende una volta sola, prima di filtrare: `Date.now()` dentro
  // il render è impuro, e su una lista lunga darebbe risultati che cambiano
  // mentre la si sta costruendo.
  const adesso = Date.parse(new Date().toISOString());
  const ultimaSettimana = righe.filter((r) => adesso - Date.parse(r.created_at) < 7 * 24 * 3600_000);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageTitle
        kicker="Assistente"
        title="Cosa ci chiedono"
        sub={`${righe.length} domande registrate · ${ultimaSettimana.length} negli ultimi 7 giorni · ${senzaRisposta.length} senza risposta`}
      />

      <Card className="mb-4">
        <p className="text-sm font-medium text-muted">
          Sono le domande fatte al riquadro «Domande?» del sito.{" "}
          <strong className="text-navy">Quelle senza risposta sono l&apos;elenco delle FAQ da scrivere</strong>: ogni
          riga qui sotto è una cosa che oggi spieghiamo a voce. Le risposte vengono dalle FAQ ufficiali più i
          prezzi e le zone letti dal database, quindi per sistemarne una basta aggiungere la voce giusta.
        </p>
      </Card>

      {senzaRisposta.length > 0 && (
        <Card className="mb-4">
          <h2 className="font-display text-sm font-extrabold text-navy">Non ha saputo rispondere ({senzaRisposta.length})</h2>
          <ul className="mt-3 space-y-2">
            {senzaRisposta.slice(0, 30).map((r) => (
              <li key={r.id} className="rounded-[12px] border border-[#C9881F]/30 bg-[#C9881F]/8 px-3 py-2">
                <div className="text-sm font-semibold text-navy">{r.domanda}</div>
                <div className="mt-0.5 text-[11px] font-medium text-muted">
                  {fmt(r.created_at)} · {r.canale}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="font-display text-sm font-extrabold text-navy">Tutte, dalla più recente</h2>
        {righe.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-muted">
            Ancora nessuna domanda registrata. Si popola da sola appena qualcuno usa il riquadro sul sito.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {righe.map((r) => (
              <li key={r.id} className="border-b border-line/60 pb-3 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-navy">{r.domanda}</span>
                  <span className="text-[11px] font-medium text-muted">
                    {fmt(r.created_at)} · {r.canale}
                    {r.non_lo_so && <span className="ml-2 font-bold text-[#C9881F]">senza risposta</span>}
                  </span>
                </div>
                {r.risposta && (
                  <p className="mt-1 whitespace-pre-line text-sm font-medium leading-relaxed text-muted">{r.risposta}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
