import Link from "next/link";
import type { Passaggio } from "@/lib/passaggi";
import { fmtSlot, fmtDate } from "@/lib/format";

/** Le righe della lista: un ritiro o una riconsegna, mai «un ordine».
 *
 *  Ogni riga dice tre cose e basta: cosa succede, quando, e a che punto è.
 *  Toccandola si apre il servizio completo, con la storia e il rider. */

const ICONA: Record<Passaggio["tipo"], string> = { ritiro: "🧺", riconsegna: "🚚" };
const TITOLO: Record<Passaggio["tipo"], string> = { ritiro: "Ritiro", riconsegna: "Riconsegna" };

const STATO: Record<Passaggio["stato"], { testo: string; classe: string }> = {
  previsto: { testo: "", classe: "" },
  fatto: { testo: "fatto", classe: "bg-[#1F8A5B]/12 text-[#1F8A5B]" },
  non_riuscito: { testo: "non riuscita", classe: "bg-[#C0392B]/12 text-[#C0392B]" },
  annullato: { testo: "annullato", classe: "bg-navy/10 text-navy/50" },
};

function quandoLeggibile(p: Passaggio): string {
  if (!p.quando) return "Da programmare — ti avvisiamo noi";
  return p.fine ? fmtSlot(p.quando, p.fine) : fmtDate(p.quando);
}

export function ListaPassaggi({ passaggi, vuoto }: { passaggi: Passaggio[]; vuoto: string }) {
  if (passaggi.length === 0) {
    return <p className="rounded-[18px] border border-line bg-white p-5 text-sm font-medium text-muted">{vuoto}</p>;
  }

  return (
    <div className="space-y-2.5">
      {passaggi.map((p) => {
        const s = STATO[p.stato];
        return (
          <Link
            key={p.chiave}
            href={`/app/ordini/${p.orderId}`}
            className="flex items-center gap-3.5 rounded-[18px] border border-line bg-white p-4 transition-colors hover:border-navy/25"
          >
            <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-full bg-ice text-lg">
              {ICONA[p.tipo]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-extrabold text-navy">{TITOLO[p.tipo]}</span>
                {s.testo && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${s.classe}`}>
                    {s.testo}
                  </span>
                )}
              </div>
              <div className={`text-sm font-medium ${p.quando ? "text-navy/70" : "text-muted"}`}>{quandoLeggibile(p)}</div>
              <div className="text-xs font-medium text-muted">
                {p.bags} {p.bags === 1 ? "sacco" : "sacchi"}
              </div>
            </div>
            <span aria-hidden className="flex-none font-display text-lg text-navy/25">›</span>
          </Link>
        );
      })}
    </div>
  );
}
