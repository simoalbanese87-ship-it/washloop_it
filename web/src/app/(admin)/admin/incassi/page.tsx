import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { createServiceClient } from "@/lib/supabase/server";
import { ficMode } from "@/lib/fic";
import { riemettiFattura } from "@/lib/actions/fatture";
import { fmtFull } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Incassi: cosa abbiamo preso, e con quale documento.
 *
 *  Si chiamava "Fatture", ma nel regime scelto la fattura è l'eccezione: quasi
 *  tutti gli incassi hanno solo la ricevuta, e chiamare "Fatture" una pagina
 *  fatta al 95% di ricevute rendeva difficile perfino cercarla.
 *
 *  I filtri sono in querystring, così un periodo si può salvare tra i preferiti
 *  o mandare a qualcuno: `?tipo=`, `?dal=`, `?al=`. */

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
  emessa: "Fattura",
  da_emettere: "Fattura richiesta",
  errore: "Errore",
  saltata: "Ricevuta",
};

/** Estremi ISO del periodo. `dal`/`al` sono giorni civili italiani (YYYY-MM-DD);
 *  `al` è inclusivo, quindi arriva a fine giornata. */
function periodo(dal?: string, al?: string): { da: string | null; a: string | null } {
  const valido = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const d = valido(dal);
  const a = valido(al);
  return {
    da: d ? `${d}T00:00:00.000Z` : null,
    a: a ? new Date(new Date(`${a}T00:00:00.000Z`).getTime() + 86_400_000).toISOString() : null,
  };
}

export default async function IncassiPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string; tipo?: string; dal?: string; al?: string }>;
}) {
  const { ok, warn, tipo, dal, al } = await searchParams;
  const { da, a } = periodo(dal, al);

  const svc = createServiceClient();
  let q = svc
    .from("invoices")
    .select("id, stripe_invoice_id, amount_cents, stato, fic_number, fic_url, ei_status, errore, created_at, profiles(full_name, client_code)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (da) q = q.gte("created_at", da);
  if (a) q = q.lt("created_at", a);
  // Il tipo di documento è lo stato della riga: "saltata" = solo ricevuta.
  if (tipo === "ricevuta") q = q.eq("stato", "saltata");
  if (tipo === "fattura") q = q.eq("stato", "emessa");
  if (tipo === "richiesta") q = q.in("stato", ["da_emettere", "errore"]);

  const { data } = await q.returns<Riga[]>();
  const righe = data ?? [];

  const totale = righe.reduce((t, r) => t + r.amount_cents, 0);
  const ricevute = righe.filter((r) => r.stato === "saltata").length;
  const fatture = righe.filter((r) => r.stato === "emessa").length;
  const daEmettere = righe.filter((r) => r.stato === "da_emettere").length;
  const inErrore = righe.filter((r) => r.stato === "errore").length;

  const mode = ficMode();
  const { data: token } = await svc.from("fic_tokens").select("company_id, updated_at").eq("id", 1).maybeSingle<{ company_id: number | null; updated_at: string }>();
  const collegato = !!token;

  // Scorciatoie di periodo, calcolate sul giorno civile italiano.
  const oggiRoma = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const primoDelMese = `${oggiRoma.slice(0, 7)}-01`;
  const primoDellAnno = `${oggiRoma.slice(0, 4)}-01-01`;

  const preset = [
    { label: "Oggi", dal: oggiRoma, al: oggiRoma },
    { label: "Questo mese", dal: primoDelMese, al: oggiRoma },
    { label: "Quest'anno", dal: primoDellAnno, al: oggiRoma },
    { label: "Tutto", dal: "", al: "" },
  ];

  const qs = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ tipo, dal, al, ...p })) if (v) u.set(k, v);
    return u.toString() ? `?${u}` : "";
  };

  const input = "h-10 rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";
  const attivo = (v: boolean) => `rounded-full px-4 py-2 font-display text-sm font-bold ${v ? "bg-navy text-white" : "border border-line bg-white text-navy"}`;

  return (
    <>
      <PageTitle
        kicker="Incassi"
        title="Incassi e documenti"
        sub="Ricevuta a tutti, fattura solo a chi la chiede. Qui c'è tutto quello che è stato incassato."
      />

      {ok && <div className="mb-4 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] bg-[#C9881F]/12 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      {/* Filtri */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {preset.map((p) => (
            <Link key={p.label} href={`/admin/incassi${qs({ dal: p.dal, al: p.al })}`} className={attivo(dal === p.dal && al === p.al)}>
              {p.label}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {([["", "Tutti i documenti"], ["ricevuta", "Solo ricevute"], ["fattura", "Solo fatture"], ["richiesta", "Fatture da fare"]] as const).map(([v, l]) => (
            <Link key={v || "tutti"} href={`/admin/incassi${qs({ tipo: v || undefined })}`} className={attivo((tipo ?? "") === v)}>
              {l}
            </Link>
          ))}
        </div>

        <form className="mt-3 flex flex-wrap items-end gap-2">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <label className="text-xs font-bold text-muted">
            Dal
            <input type="date" name="dal" defaultValue={dal ?? ""} className={`${input} mt-1 block`} />
          </label>
          <label className="text-xs font-bold text-muted">
            Al
            <input type="date" name="al" defaultValue={al ?? ""} className={`${input} mt-1 block`} />
          </label>
          <button type="submit" className="rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-2 font-display text-sm font-extrabold text-white">
            Filtra
          </button>
          <a
            href={`/admin/incassi/export${qs({})}`}
            className="rounded-full border-2 border-navy/25 px-5 py-2 font-display text-sm font-extrabold text-navy hover:bg-navy/5"
          >
            ⬇ Scarica CSV ({righe.length})
          </a>
        </form>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 lg:grid-cols-4">
          <div>
            <div className="font-display text-2xl font-black text-navy">{eur(totale)}</div>
            <div className="text-[11px] font-semibold text-muted">Incassato (IVA incl.)</div>
          </div>
          <div>
            <div className="font-display text-2xl font-black text-navy">{ricevute}</div>
            <div className="text-[11px] font-semibold text-muted">Con sola ricevuta</div>
          </div>
          <div>
            <div className="font-display text-2xl font-black text-navy">{fatture}</div>
            <div className="text-[11px] font-semibold text-muted">Con fattura emessa</div>
          </div>
          <div>
            <div className={`font-display text-2xl font-black ${daEmettere + inErrore > 0 ? "text-[#C9881F]" : "text-navy/25"}`}>{daEmettere + inErrore}</div>
            <div className="text-[11px] font-semibold text-muted">Fatture da fare</div>
          </div>
        </div>
      </Card>

      {/* Collegamento a Fatture in Cloud */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-navy">
              {mode === "off"
                ? "Fatture in Cloud: collegato ma non attivo"
                : mode === "bozza"
                  ? "Fatture in Cloud attivo — crea i documenti, non li manda allo SdI"
                  : "Fatture in Cloud attivo — crea e trasmette allo SdI"}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted">
              {mode === "off"
                ? "Le richieste di fattura restano in attesa: si emette quando accendiamo FIC_MODE, senza deploy."
                : `${daEmettere} da emettere · ${inErrore} in errore`}
            </p>
            <p className="mt-1 text-sm font-medium text-muted">
              {collegato
                ? `Account collegato${token?.company_id ? ` (azienda ${token.company_id})` : ""} · token aggiornato ${fmtFull(token!.updated_at)}`
                : "Account non ancora collegato."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/lavanderia" className="rounded-full border-2 border-navy/20 px-5 py-2.5 font-display text-sm font-extrabold text-navy">
              Uscite verso la lavanderia →
            </Link>
            <a href="/api/fic/connect" className="rounded-full bg-navy px-5 py-2.5 font-display text-sm font-extrabold text-white">
              {collegato ? "Ricollega" : "Collega Fatture in Cloud →"}
            </a>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-base font-extrabold text-navy">
          {righe.length} {righe.length === 1 ? "incasso" : "incassi"}
          {dal || al ? " nel periodo" : ""}
        </h2>
        <p className="mt-1 text-sm font-medium text-muted">
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
                {(r.stato === "da_emettere" || r.stato === "errore") && mode !== "off" && (
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
            <p className="py-3 text-sm font-medium text-muted">Nessun incasso nel periodo scelto.</p>
          )}
        </div>
      </Card>
    </>
  );
}
