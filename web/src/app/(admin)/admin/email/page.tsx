import { Card, PageTitle } from "@/components/app/AppShell";
import { brevoEvents, brevoAccount, type BrevoEvent } from "@/lib/brevo";
import { createServiceClient } from "@/lib/supabase/server";
import { fmtFull } from "@/lib/format";

type RigaLog = {
  id: string;
  destinatario: string;
  oggetto: string;
  esito: "inviata" | "saltata" | "fallita";
  message_id: string | null;
  errore: string | null;
  created_at: string;
};

const TONO_LOG: Record<RigaLog["esito"], string> = {
  inviata: "bg-[#1F8A5B]/15 text-[#1F8A5B]",
  saltata: "bg-[#C9881F]/12 text-[#C9881F]",
  fallita: "bg-[#C0392B]/12 text-[#C0392B]",
};

/** Admin → Email: stato invii transazionali via Brevo (consegnata/aperta/bounce).
 *  Ricerca per indirizzo con ?q=email. */

const EVENT_LABEL: Record<string, string> = {
  requests: "Inviata", delivered: "Consegnata", opened: "Aperta", clicks: "Click",
  softBounces: "Soft bounce", hardBounces: "Hard bounce", bounces: "Bounce",
  blocked: "Bloccata", spam: "Spam", deferred: "In ritardo", unsubscribed: "Disiscritto", invalid_email: "Email non valida",
};
const tone = (e: string) =>
  e === "delivered" || e === "opened" || e === "clicks" ? "bg-[#1F8A5B]/15 text-[#1F8A5B]"
    : e === "requests" || e === "deferred" ? "bg-navy/10 text-navy"
    : "bg-[#C0392B]/12 text-[#C0392B]";

function fmt(d: string) {
  try { return new Date(d).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

export default async function EmailPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const email = (q ?? "").trim() || undefined;
  // Due fonti, e servono entrambe. Brevo sa che cosa è successo DOPO che gli
  // abbiamo passato il messaggio — consegnata, aperta, rimbalzata. Il registro
  // locale sa che cosa abbiamo TENTATO, e copre il caso che Brevo non può
  // vedere: l'email che non è mai uscita da qui (SMTP spento, destinatario
  // senza indirizzo). Il 4 settembre un cliente ha detto «non mi è arrivata» e
  // non c'era modo di distinguere i due casi.
  const svc = createServiceClient();
  let qLog = svc
    .from("email_log")
    .select("id, destinatario, oggetto, esito, message_id, errore, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (email) qLog = qLog.ilike("destinatario", `%${email}%`);

  const [acc, res, { data: log }] = await Promise.all([
    brevoAccount(),
    brevoEvents({ limit: 60, email }),
    qLog.returns<RigaLog[]>(),
  ]);
  const righeLog = log ?? [];
  const nonPartite = righeLog.filter((r) => r.esito !== "inviata").length;

  const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";

  return (
    <>
      <PageTitle
        kicker="Email"
        title="Invii transazionali"
        sub={acc.ok ? `Brevo · ${acc.email} · ${acc.credits} crediti rimasti` : "Stato consegne email (Brevo)"}
      />

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-2">
          <label className="flex-1 text-xs font-bold text-muted">Cerca per indirizzo email
            <input name="q" defaultValue={q ?? ""} placeholder="cliente@email.it" className={`${input} mt-1`} />
          </label>
          <button type="submit" className="rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-2 font-display text-sm font-extrabold text-white">Cerca</button>
          {q && <a href="/admin/email" className="rounded-full border border-line px-4 py-2 font-display text-sm font-bold text-navy">Pulisci</a>}
        </form>
      </Card>

      {!res.ok ? (
        <Card><p className="text-sm font-semibold text-[#C0392B]">Errore Brevo: {res.error}</p></Card>
      ) : res.events.length === 0 ? (
        <Card><p className="text-sm font-medium text-muted">Nessun evento email{email ? ` per ${email}` : ""}.</p></Card>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-line bg-white">
          <div className="grid grid-cols-[1fr_1.6fr_2fr_auto] gap-4 border-b border-line bg-ice px-6 py-3 font-display text-xs font-extrabold uppercase tracking-wide text-blue">
            <div>Data</div><div>Destinatario</div><div>Oggetto</div><div>Stato</div>
          </div>
          {res.events.map((e: BrevoEvent, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.6fr_2fr_auto] items-center gap-4 border-b border-line px-6 py-3 last:border-0 text-sm">
              <div className="font-medium text-muted">{fmt(e.date)}</div>
              <div className="truncate font-semibold text-navy">{e.email}</div>
              <div className="truncate text-muted">{e.subject ?? "—"}</div>
              <div><span className={`inline-flex rounded-full px-2.5 py-1 font-display text-xs font-bold ${tone(e.event)}`}>{EVENT_LABEL[e.event] ?? e.event}</span></div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs font-medium text-muted">Dati live da Brevo. «Consegnata» = arrivata al provider; «Aperta» = il destinatario l&apos;ha aperta; «Bounce/Bloccata/Spam» = problema di recapito.</p>

      {/* Registro locale: che cosa ha tentato di mandare il sistema. */}
      <div className="mt-8">
        <h2 className="font-display text-lg font-extrabold text-navy">Registro degli invii</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Quello che <strong>noi</strong> abbiamo provato a mandare. Se una riga è «fallita» o «saltata», il
          messaggio non è mai arrivato a Brevo — quindi lì sopra non lo troverai.
          {nonPartite > 0 ? ` Ce ne sono ${nonPartite} non partite.` : ""}
        </p>

        {righeLog.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm font-medium text-muted">
              Nessun invio registrato{email ? ` per ${email}` : ""}. Il registro parte dal 4 settembre 2026:
              le email precedenti non ci sono.
            </p>
          </Card>
        ) : (
          <div className="mt-4 space-y-2">
            {righeLog.map((r) => (
              <Card key={r.id} className="!p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-display text-sm font-extrabold text-navy">{r.oggetto}</span>
                  <span className={`rounded-full px-2.5 py-1 font-display text-xs font-bold ${TONO_LOG[r.esito]}`}>{r.esito}</span>
                </div>
                <div className="mt-1 text-sm font-medium text-muted">{r.destinatario} · {fmtFull(r.created_at)}</div>
                {r.errore && <div className="mt-1 text-xs font-bold text-[#C0392B]">{r.errore}</div>}
                {r.message_id && <div className="mt-1 break-all font-mono text-[11px] text-muted">{r.message_id}</div>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
