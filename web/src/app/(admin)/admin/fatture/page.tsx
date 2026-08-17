import { Card, PageTitle } from "@/components/app/AppShell";
import { createServiceClient } from "@/lib/supabase/server";
import { ficMode } from "@/lib/fic";
import { riemettiFattura } from "@/lib/actions/fatture";
import { fmtFull } from "@/lib/format";

export const dynamic = "force-dynamic";

type Riga = {
  id: string;
  stripe_invoice_id: string | null;
  amount_cents: number;
  stato: string;
  fic_number: string | null;
  fic_url: string | null;
  ei_status: string | null;
  errore: string | null;
  created_at: string;
  profiles: { full_name: string | null; client_code: string | null } | null;
};

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

const TONO: Record<string, string> = {
  emessa: "bg-[#1F8A5B]/12 text-[#1F8A5B]",
  da_emettere: "bg-[#C9881F]/12 text-[#C9881F]",
  errore: "bg-[#C0392B]/12 text-[#C0392B]",
  saltata: "bg-navy/10 text-navy/60",
};

const ETICHETTA: Record<string, string> = {
  emessa: "Emessa",
  da_emettere: "Da emettere",
  errore: "Errore",
  saltata: "Solo ricevuta",
};

/** Registro degli incassi e delle fatture su Fatture in Cloud.
 *
 *  La riga si scrive a ogni incasso Stripe, anche quando il ponte è spento: è
 *  quello che permette, il giorno in cui il regime fiscale sarà deciso, di
 *  sapere esattamente cosa è stato incassato e cosa manca — senza ricostruirlo
 *  a mano dal pannello Stripe. */
export default async function FatturePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string }>;
}) {
  const { ok, warn } = await searchParams;
  const svc = createServiceClient();
  const { data } = await svc
    .from("invoices")
    .select("id, stripe_invoice_id, amount_cents, stato, fic_number, fic_url, ei_status, errore, created_at, profiles(full_name, client_code)")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Riga[]>();

  const righe = data ?? [];
  const daEmettere = righe.filter((r) => r.stato === "da_emettere").length;
  const soloRicevuta = righe.filter((r) => r.stato === "saltata").length;
  const inErrore = righe.filter((r) => r.stato === "errore").length;
  const mode = ficMode();
  const { data: token } = await svc.from("fic_tokens").select("company_id, updated_at").eq("id", 1).maybeSingle<{ company_id: number | null; updated_at: string }>();
  const collegato = !!token;

  return (
    <>
      <PageTitle
        kicker="Fatture"
        title="Incassi e fatturazione"
        sub="Ricevuta a tutti, fattura solo a chi la chiede. Ogni incasso è tracciato qui; la fattura la crea Fatture in Cloud."
      />

      {ok && <div className="mb-4 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] bg-[#C9881F]/12 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <Card className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-navy">
              {mode === "off"
                ? "Ponte verso Fatture in Cloud: spento"
                : mode === "bozza"
                  ? "Ponte attivo — crea le fatture, non le manda allo SdI"
                  : "Ponte attivo — crea e trasmette allo SdI"}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted">
              {mode === "off"
                ? `Le richieste di fattura vengono registrate ma non emesse: si accende con FIC_MODE, nessun deploy. ${daEmettere} in attesa.`
                : `${daEmettere} da emettere · ${inErrore} in errore`}
            </p>
            <p className="mt-1 text-sm font-medium text-muted">
              {collegato
                ? `Account collegato${token?.company_id ? ` (azienda ${token.company_id})` : ""} · ultimo aggiornamento token ${fmtFull(token!.updated_at)}`
                : "Account non ancora collegato."}
            </p>
          </div>
          <a
            href="/api/fic/connect"
            className="rounded-full bg-navy px-5 py-2.5 font-display text-sm font-extrabold text-white"
          >
            {collegato ? "Ricollega account" : "Collega Fatture in Cloud →"}
          </a>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-base font-extrabold text-navy">Ultimi 100 incassi</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          {soloRicevuta} con la sola ricevuta (il caso normale) · {daEmettere} con fattura richiesta.
          I dati fiscali li lascia il cliente dalla sua area, alla voce «Ricevuta e fattura».
        </p>
        <div className="mt-3 divide-y divide-line">
          {righe.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-bold text-navy">{r.profiles?.full_name ?? "—"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${TONO[r.stato] ?? "bg-navy/10 text-navy"}`}>
                    {ETICHETTA[r.stato] ?? r.stato}
                  </span>
                  {r.ei_status && (
                    <span className="rounded-full bg-navy/8 px-2 py-0.5 text-[10px] font-bold text-navy/70">SdI: {r.ei_status}</span>
                  )}
                </div>
                <div className="text-xs font-medium text-muted">
                  {eur(r.amount_cents)} · {fmtFull(r.created_at)}
                  {r.fic_number && <> · fattura n. {r.fic_number}</>}
                  {r.profiles?.client_code && <> · {r.profiles.client_code}</>}
                </div>
                {r.errore && <div className="mt-1 text-xs font-semibold text-[#C0392B]">{r.errore}</div>}
              </div>

              <div className="flex flex-none items-center gap-3">
                {r.fic_url && (
                  <a href={r.fic_url} target="_blank" rel="noreferrer" className="font-display text-[11px] font-bold text-blue hover:underline">
                    Apri su FIC
                  </a>
                )}
                {r.stato !== "emessa" && mode !== "off" && (
                  <form action={riemettiFattura}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="rounded-full border-2 border-navy/20 px-3 py-1.5 font-display text-[11px] font-bold text-navy">
                      {r.stato === "errore" ? "Riprova" : "Emetti"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
          {righe.length === 0 && (
            <p className="py-3 text-sm font-medium text-muted">Nessun incasso registrato: qui compariranno a partire dal prossimo pagamento.</p>
          )}
        </div>
      </Card>
    </>
  );
}
