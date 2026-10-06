import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { linkInvito } from "@/lib/invito";
import { siteUrl } from "@/lib/stripe";
import { LinkOfferta } from "@/components/admin/LinkOfferta";

export const dynamic = "force-dynamic";

/** «Porta un amico», lato cliente.
 *
 *  Due cose e basta: il link da mandare, e la prova che funziona — gli amici
 *  che hai già portato e quanto ti hanno fatto risparmiare. La seconda serve
 *  quanto la prima: un programma di invito che non mostra i risultati si usa
 *  una volta e poi ci si dimentica che esiste. */

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

type Premio = {
  id: string;
  stato: string;
  valore_cents: number;
  created_at: string;
  invitato: { full_name: string | null } | { full_name: string | null }[] | null;
};

const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const soloNome = (full: string | null) => (full ?? "").trim().split(/\s+/)[0] || "Un amico";

export default async function InvitaPage() {
  const profile = await getCurrentProfile();
  // Service client, e filtro esplicito sull'utente: con la sessione del cliente
  // la RLS di `profiles` nasconderebbe il nome dell'amico — non un errore, un
  // `null` — e la pagina direbbe «Un amico» a chi quell'amico l'ha portato lui.
  // Il filtro per `invitante_id` è la garanzia, e sta scritto qui sopra.
  const svc = createServiceClient();
  const { data: premi } = profile
    ? await svc
        .from("referral_premi")
        .select("id, stato, valore_cents, created_at, invitato:profiles!referral_premi_invitato_id_fkey(full_name)")
        .eq("invitante_id", profile.id)
        .order("created_at", { ascending: false })
        .returns<Premio[]>()
    : { data: [] as Premio[] };

  const codice = profile?.client_code ?? null;
  const link = codice ? linkInvito(siteUrl(), codice) : null;
  const lista = premi ?? [];
  const guadagnato = lista.reduce((t, p) => t + (p.stato === "accreditato" ? p.valore_cents : 0), 0);
  const testo = link
    ? `Io uso WashLoop: ritirano il bucato sotto casa e te lo riportano lavato e stirato. Se ti iscrivi da qui fai un favore a me 🙂 ${link}`
    : "";

  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Porta un amico</div>
        <h1 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">Una settimana in regalo</h1>
        <p className="mt-2 text-sm font-medium text-muted">
          Manda il tuo link a chi vuoi. Quando un amico attiva un abbonamento, a te regaliamo{" "}
          <strong className="text-navy">una settimana</strong>: la scaliamo in automatico dalla tua prossima fattura.
          Non c&apos;è un limite al numero di amici.
        </p>
      </div>

      {link ? (
        <section className="rounded-[22px] border border-line bg-white p-5">
          <h2 className="font-display text-base font-extrabold text-navy">Il tuo link</h2>
          <div className="mt-3">
            <LinkOfferta url={link} />
          </div>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(testo)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]"
          >
            Manda su WhatsApp →
          </a>
          <p className="mt-3 text-xs font-medium text-muted">
            Il codice <strong className="text-navy">{codice}</strong>{" "}è lo stesso che trovi sull&apos;etichetta del tuo
            sacco: non devi ricordarne un altro.
          </p>
        </section>
      ) : (
        <section className="rounded-[22px] border border-line bg-white p-5">
          <p className="text-sm font-medium text-muted">
            Il tuo codice non è ancora pronto. Scrivici a info@washloop.it e lo sistemiamo subito.
          </p>
        </section>
      )}

      <section className="rounded-[22px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-extrabold text-navy">Gli amici che hai portato</h2>
          {guadagnato > 0 && (
            <span className="font-display text-sm font-black text-[#1F8A5B]">{eur(guadagnato)} risparmiati</span>
          )}
        </div>
        {lista.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-muted">
            Ancora nessuno. Il primo che attiva un abbonamento vale una settimana.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {lista.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="font-display text-sm font-bold text-navy">{soloNome(uno(p.invitato)?.full_name ?? null)}</div>
                  <div className="text-xs font-medium text-muted">
                    {p.stato === "accreditato"
                      ? "Settimana accreditata"
                      : p.stato === "maturato"
                        ? "In arrivo sulla prossima fattura"
                        : p.stato === "sospeso"
                          ? "Ci stiamo lavorando"
                          : "Annullato"}
                  </div>
                </div>
                <span className="font-display text-sm font-extrabold text-navy">
                  {p.valore_cents > 0 ? eur(p.valore_cents) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/app/profilo" className="inline-flex font-display text-sm font-bold text-blue hover:underline">
        ← Torna al profilo
      </Link>
    </div>
  );
}
