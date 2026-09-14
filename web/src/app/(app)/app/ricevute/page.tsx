import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";

/** Le ricevute del cliente, numerate da noi.
 *
 *  Questa pagina si chiamava «Fatture» ed elencava gli oggetti invoice di
 *  Stripe, col numero che Stripe assegna loro. Ma le fatture non le emette
 *  Stripe: nel regime scelto la fattura è l'eccezione — la emettiamo noi da
 *  Fatture in Cloud, e solo a chi la chiede. Quello che accompagna ogni incasso
 *  è una ricevuta, numerata nella nostra tabella `invoices`.
 *
 *  Lo stesso pagamento aveva quindi due numeri: il nostro nel registro admin e
 *  quello di Stripe mostrato qui. Se un cliente chiama citando un numero, quello
 *  a cui sappiamo rispondere è il nostro — e ora è l'unico che vede.
 *
 *  Il PDF di Stripe non si linka più, ed è voluto: è intestato come una fattura
 *  e porta la numerazione del fornitore. Darlo a chi la fattura non l'ha
 *  chiesta è esattamente la confusione da cui questa pagina esce. */

const ChevLeft = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
);
const DocIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
);

type Riga = {
  id: string;
  numero_ricevuta: number | null;
  amount_cents: number;
  created_at: string;
  fic_number: string | null;
  fic_url: string | null;
};

export default async function RicevutePage() {
  const supabase = await createClient();
  // Solo le proprie: la policy `invoices cliente legge le proprie` (migration
  // 0069) filtra sul `user_id`, e senza sessione non torna niente.
  const { data } = await supabase
    .from("invoices")
    .select("id, numero_ricevuta, amount_cents, created_at, fic_number, fic_url")
    .order("created_at", { ascending: false })
    .limit(36)
    .returns<Riga[]>();

  const righe = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/app/profilo" aria-label="Indietro" className="grid h-11 w-11 place-items-center rounded-full bg-white text-navy shadow-[0_1px_0_rgba(27,45,94,0.04),0_10px_24px_-18px_rgba(27,45,94,0.5)]">
          <ChevLeft />
        </Link>
        <h1 className="font-display text-lg font-black tracking-[-0.02em] text-navy">Ricevute</h1>
      </div>

      {righe.length === 0 ? (
        <div className="rounded-[18px] border border-line bg-white px-4 py-8 text-center text-sm font-medium text-muted">
          Nessuna ricevuta ancora. Compaiono qui dopo il primo pagamento.
        </div>
      ) : (
        <section className="overflow-hidden rounded-[18px] border border-line bg-white">
          {righe.map((r) => {
            // Si apre solo se c'è davvero un documento da aprire: la fattura
            // elettronica, per chi l'ha chiesta. Una riga senza fattura non è
            // un link morto, è una riga.
            const Wrap = r.fic_url ? "a" : "div";
            return (
              <Wrap
                key={r.id}
                {...(r.fic_url ? { href: r.fic_url, target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0 transition-colors active:bg-ice"
              >
                <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-ice text-blue"><DocIcon /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm font-bold text-navy">
                    {r.numero_ricevuta ? `Ricevuta n. ${r.numero_ricevuta}` : "Ricevuta"}
                  </span>
                  <span className="block text-xs font-medium text-muted">
                    {fmtDate(new Date(r.created_at))}
                    {r.fic_number ? ` · Fattura n. ${r.fic_number}` : ""}
                  </span>
                </span>
                <span className="font-display text-sm font-extrabold text-navy">
                  €{(r.amount_cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </Wrap>
            );
          })}
        </section>
      )}

      <p className="text-center text-xs font-medium text-muted">
        Ogni ricevuta comprende l&apos;abbonamento e gli eventuali capi extra del mese.
        Se ti serve la <strong>fattura</strong>, dicci come intestarla dalla{" "}
        <Link href="/app/abbonamento" className="font-bold text-blue">pagina abbonamento</Link>.
      </p>
    </div>
  );
}
