import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { BottoneInvio } from "@/components/ui/BottoneInvio";
import { createServiceClient } from "@/lib/supabase/server";
import { accreditaPremioAdmin } from "@/lib/actions/referral-admin";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Porta un amico, dal lato di chi paga il regalo.
 *
 *  Tre domande, in quest'ordine: chi ha portato chi, quanto abbiamo regalato, e
 *  cosa è rimasto in sospeso. La terza è l'unica che richiede di fare qualcosa,
 *  e per questo sta in cima quando non è vuota. */

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

const TONO: Record<string, string> = {
  accreditato: "bg-[#1F8A5B]/12 text-[#1F8A5B]",
  maturato: "bg-[#2b7fd4]/12 text-blue",
  sospeso: "bg-[#C9881F]/15 text-[#C9881F]",
  annullato: "bg-navy/10 text-navy/60",
};
const ETICHETTA: Record<string, string> = {
  accreditato: "Accreditato",
  maturato: "Maturato",
  sospeso: "Sospeso",
  annullato: "Annullato",
};

type Riga = {
  id: string;
  stato: string;
  valore_cents: number;
  motivo: string | null;
  created_at: string;
  accreditato_at: string | null;
  invitante: { id: string; full_name: string | null; client_code: string | null } | null;
  invitato: { id: string; full_name: string | null; client_code: string | null } | null;
};

type Attesa = { id: string; full_name: string | null; invitato_il: string | null; invitante: { full_name: string | null } | null };

export default async function Inviti() {
  const svc = createServiceClient();
  const [{ data: premi }, { data: inAttesa }] = await Promise.all([
    svc
      .from("referral_premi")
      .select("id, stato, valore_cents, motivo, created_at, accreditato_at, invitante:profiles!referral_premi_invitante_id_fkey(id, full_name, client_code), invitato:profiles!referral_premi_invitato_id_fkey(id, full_name, client_code)")
      .order("created_at", { ascending: false })
      .returns<Riga[]>(),
    // Chi è arrivato da un invito ma non ha ancora comprato: è il bacino da cui
    // nascono i premi, e senza questa riga il programma sembra fermo anche
    // quando sta funzionando.
    svc
      .from("profiles")
      .select("id, full_name, invitato_il, invitante:profiles!profiles_invitato_da_fkey(full_name)")
      .not("invitato_da", "is", null)
      .order("invitato_il", { ascending: false })
      .returns<Attesa[]>(),
  ]);

  const lista = premi ?? [];
  const premiati = new Set(lista.map((p) => p.invitato?.id).filter(Boolean));
  const senzaAcquisto = (inAttesa ?? []).filter((p) => !premiati.has(p.id));
  const sospesi = lista.filter((p) => p.stato === "sospeso");
  const regalato = lista.reduce((t, p) => t + (p.stato === "accreditato" ? p.valore_cents : 0), 0);

  return (
    <>
      <PageTitle
        kicker="Crescita"
        title="Porta un amico"
        sub={`${lista.length} ${lista.length === 1 ? "premio" : "premi"} · ${eur(regalato)} regalati · ${senzaAcquisto.length} ${senzaAcquisto.length === 1 ? "invito in attesa" : "inviti in attesa"}`}
      />

      <Card className="mb-4">
        <p className="text-sm font-medium text-muted">
          Chi porta un amico riceve <strong className="text-navy">una settimana del proprio piano</strong>, accreditata
          come credito su Stripe e scalata in automatico dalla fattura successiva. Il premio scatta al{" "}
          <strong className="text-navy">primo acquisto</strong>{" "}dell&apos;amico, mai sui rinnovi, e vale una volta sola
          per ogni persona portata. Il codice di invito è il <strong className="text-navy">WL-</strong> che il cliente ha
          già.
        </p>
      </Card>

      {sospesi.length > 0 && (
        <Card className="mb-4 border-[#C9881F]/40">
          <h2 className="font-display text-base font-extrabold text-[#C9881F]">
            {sospesi.length === 1 ? "1 premio da sistemare" : `${sospesi.length} premi da sistemare`}
          </h2>
          <p className="mt-1 text-sm font-medium text-muted">
            Il premio spetta ma non c&apos;era un canone su cui calcolarlo: chi ha invitato non aveva un abbonamento
            attivo. Se adesso ce l&apos;ha, il bottone lo calcola e lo accredita.
          </p>
          <div className="mt-3 divide-y divide-line">
            {sospesi.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="font-display text-sm font-bold text-navy">
                    {p.invitante?.full_name ?? "—"} <span className="text-muted">ha portato</span> {p.invitato?.full_name ?? "—"}
                  </div>
                  {p.motivo && <div className="text-xs font-medium text-muted">{p.motivo}</div>}
                </div>
                <form action={accreditaPremioAdmin}>
                  <input type="hidden" name="premio_id" value={p.id} />
                  <BottoneInvio className="rounded-full bg-gradient-to-br from-blue to-cyan px-4 py-2 font-display text-xs font-extrabold text-white">
                    Accredita adesso
                  </BottoneInvio>
                </form>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="font-display text-base font-extrabold text-navy">I premi</h2>
        {lista.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-muted">
            Ancora nessun premio. Ne nasce uno quando una persona arrivata da un invito compra il suo primo abbonamento.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Ha invitato</th>
                  <th className="py-2 pr-3">Amico portato</th>
                  <th className="py-2 pr-3">Stato</th>
                  <th className="py-2 pr-3 text-right">Valore</th>
                  <th className="py-2 text-right">Quando</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id} className="border-b border-line/60">
                    <td className="py-2.5 pr-3">
                      {p.invitante ? (
                        <Link href={`/admin/abbonati/${p.invitante.id}`} className="font-display font-bold text-navy hover:underline">
                          {p.invitante.full_name ?? "Cliente"}
                        </Link>
                      ) : "—"}
                      <div className="font-mono text-[11px] text-muted">{p.invitante?.client_code ?? ""}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      {p.invitato ? (
                        <Link href={`/admin/abbonati/${p.invitato.id}`} className="font-display font-bold text-navy hover:underline">
                          {p.invitato.full_name ?? "Cliente"}
                        </Link>
                      ) : "—"}
                      <div className="font-mono text-[11px] text-muted">{p.invitato?.client_code ?? ""}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${TONO[p.stato] ?? TONO.annullato}`}>
                        {ETICHETTA[p.stato] ?? p.stato}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-display font-extrabold text-navy">
                      {p.valore_cents > 0 ? eur(p.valore_cents) : "—"}
                    </td>
                    <td className="py-2.5 text-right text-xs text-muted">{fmtDate(p.accreditato_at ?? p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-base font-extrabold text-navy">Inviti in attesa di acquisto</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Si sono iscritti con il link di un amico ma non hanno ancora comprato un abbonamento. Il premio nascerà da
          solo al primo pagamento.
        </p>
        {senzaAcquisto.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-muted">Nessuno in attesa.</p>
        ) : (
          <div className="mt-3 divide-y divide-line">
            {senzaAcquisto.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/abbonati/${p.id}`} className="font-display text-sm font-bold text-navy hover:underline">
                  {p.full_name ?? "Cliente"}
                </Link>
                <div className="text-xs font-medium text-muted">
                  portato da {p.invitante?.full_name ?? "—"} · {p.invitato_il ? fmtDate(p.invitato_il) : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
