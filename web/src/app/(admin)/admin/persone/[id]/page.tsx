import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/app/AppShell";
import { createServiceClient } from "@/lib/supabase/server";
import { provenienzaDove } from "@/lib/provenienza";
import { capCoperto } from "@/lib/copertura";
import { fmtFull } from "@/lib/format";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { NotaPersona } from "@/components/admin/NotaPersona";
import { LeadActions } from "@/components/admin/LeadActions";
import { CONTACT_STATUS_LABEL, isContactStatus, type ContactStatus } from "@/lib/lead-status";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  cap: string | null;
  source: string | null;
  contact_status: string;
  nota_interna: string | null;
  notes: string | null;
  created_at: string;
  archiviato_at: string | null;
  unsubscribed_at: string | null;
};

/** La scheda di un contatto che non ha ancora un account.
 *
 *  Perché esiste
 *  -------------
 *  In elenco i nomi erano cliccabili a metà: chi ha un account apriva la sua
 *  scheda, chi no restava una scritta nera. Sembrava un guasto — «perché
 *  Valeria non si apre?» — e invece era la differenza fra le due anagrafiche,
 *  che il pannello non spiegava da nessuna parte.
 *
 *  Qui c'è quello che sappiamo di lui e le tre cose che ci si fanno: diventare
 *  cliente, archiviare, eliminare. E c'è scritto, in chiaro, cosa manca e
 *  perché: senza account non può entrare in app, non gli si può creare un
 *  ritiro e non gli si può addebitare niente. */
export default async function SchedaContatto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; warn?: string }>;
}) {
  const { id } = await params;
  const { ok, warn } = await searchParams;

  const svc = createServiceClient();
  const { data: lead } = await svc
    .from("leads")
    .select("id, full_name, email, phone, cap, source, contact_status, nota_interna, notes, created_at, archiviato_at, unsubscribed_at")
    .eq("id", id)
    .maybeSingle<Lead>();
  if (!lead) notFound();

  // Se nel frattempo si è registrato, questa pagina non è più la sua: la sua è
  // la scheda cliente. Si va lì invece di mostrare due verità diverse.
  const { data: utenti } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const account = (utenti?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === lead.email.trim().toLowerCase());

  const zona = lead.cap ? (capCoperto(lead.cap) ? "in zona" : "fuori zona") : null;
  const qui = "/admin/persone";

  return (
    <>
      <Link href={qui} className="font-display text-sm font-bold text-blue hover:underline">← Persone</Link>
      <PageTitle kicker="Contatto" title={lead.full_name ?? "Senza nome"} sub={`${lead.email}${lead.phone ? ` · ${lead.phone}` : ""} · arrivato il ${fmtFull(lead.created_at)}`} />

      {ok && <div className="mb-3 rounded-[14px] border border-[#1F8A5B]/30 bg-[#1F8A5B]/8 px-4 py-2.5 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-3 rounded-[14px] border border-[#C0392B]/30 bg-[#C0392B]/8 px-4 py-2.5 text-sm font-semibold text-[#C0392B]">{warn}</div>}

      {account ? (
        <Card className="mb-4">
          <p className="text-sm font-semibold text-navy">
            Questa persona l&apos;account ce l&apos;ha già.{" "}
            <Link href={`/admin/abbonati/${account.id}`} className="font-display font-bold text-blue hover:underline">
              Apri la scheda cliente →
            </Link>
          </p>
        </Card>
      ) : (
        <Card className="mb-4">
          <h2 className="font-display text-base font-extrabold text-navy">Non ha ancora un account</h2>
          <p className="mt-1 text-sm font-medium text-muted">
            Ci ha lasciato i suoi dati, ma non esiste ancora un suo accesso a WashLoop. Finché è così{" "}
            <strong className="text-navy">non può entrare in app, non gli si può creare un ritiro e non gli si può
            addebitare niente</strong>: quelle cose vivono tutte sul suo account.
            <br />
            <strong className="text-navy">Crea cliente</strong>{" "}glielo apre: nasce il suo accesso, gli arriva
            un&apos;email con le credenziali, e da quel momento la sua scheda è una scheda cliente come tutte le altre —
            con «Accedi come», il ritiro al telefono e l&apos;abbonamento.
          </p>
          <div className="mt-3">
            <LeadActions leadId={lead.id} name={lead.full_name ?? lead.email} back={`/admin/persone/${lead.id}`} archiviato={lead.archiviato_at != null} backDopoElimina="/admin/persone" />
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Chi è</h2>
          <dl className="mt-3 space-y-2 text-sm font-medium text-muted">
            <div><dt className="inline font-bold text-navy">Email: </dt><dd className="inline">{lead.email}</dd></div>
            <div><dt className="inline font-bold text-navy">Telefono: </dt><dd className="inline">{lead.phone ?? "—"}</dd></div>
            <div>
              <dt className="inline font-bold text-navy">CAP: </dt>
              <dd className="inline">
                {lead.cap ?? "—"}
                {zona && <span className={zona === "fuori zona" ? " font-bold text-[#C0392B]" : " font-bold text-[#1F8A5B]"}> · {zona}</span>}
              </dd>
            </div>
            <div><dt className="inline font-bold text-navy">Da dove arriva: </dt><dd className="inline">{provenienzaDove(lead.source ?? "landing")}</dd></div>
            {lead.archiviato_at && (
              <div><dt className="inline font-bold text-navy">Archiviato il: </dt><dd className="inline">{fmtFull(lead.archiviato_at)}</dd></div>
            )}
            {lead.unsubscribed_at && (
              <div className="font-bold text-[#C0392B]">Ha chiesto di non ricevere più email.</div>
            )}
          </dl>
          {/* Le risposte del questionario del funnel, se le ha date. Non è la
              nota interna: quella la scriviamo noi, questa l'ha scritta lui. */}
          {lead.notes && (
            <div className="mt-3 rounded-[12px] bg-ice px-3 py-2 text-xs font-medium text-navy">
              <div className="font-display font-bold text-muted">Cosa ha scritto nel modulo</div>
              <p className="mt-1 whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">A che punto siamo</h2>
          <div className="mt-3">
            <LeadStatusSelect
              leadId={lead.id}
              value={isContactStatus(lead.contact_status) ? (lead.contact_status as ContactStatus) : "da_contattare"}
              back={`/admin/persone/${lead.id}`}
            />
            {!isContactStatus(lead.contact_status) && (
              <div className="mt-1 text-[11px] font-medium text-muted">stato mai impostato: vale «{CONTACT_STATUS_LABEL.da_contattare}»</div>
            )}
          </div>
          <div className="mt-4">
            <div className="font-display text-xs font-bold uppercase tracking-wider text-navy/40">Nota — cosa ci siamo detti</div>
            <div className="mt-1">
              <NotaPersona leadId={lead.id} nota={lead.nota_interna} back={`/admin/persone/${lead.id}`} />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
