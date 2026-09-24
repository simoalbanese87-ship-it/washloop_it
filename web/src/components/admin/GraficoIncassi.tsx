import Link from "next/link";
import type { MeseIncassi } from "@/lib/incassi-mensili";

const eur = (c: number) => "€" + (c / 100).toLocaleString("it-IT", { maximumFractionDigits: 0 });

/** Gli incassi mese per mese, a barre. Ogni barra porta ai clienti di quel mese.
 *
 *  Barre in CSS e non una libreria di grafici: sono dodici valori e una scala,
 *  e una dipendenza in più andrebbe scaricata da ogni operatore per disegnare
 *  dodici rettangoli. Sono link veri, quindi funzionano da tastiera e si
 *  possono aprire in una scheda nuova. */
export function GraficoIncassi({ mesi, prova }: { mesi: MeseIncassi[]; prova: boolean }) {
  const massimo = Math.max(1, ...mesi.map((m) => m.totaleCents));
  const totale = mesi.reduce((t, m) => t + m.totaleCents, 0);
  const conIncassi = mesi.filter((m) => m.totaleCents > 0).length;

  return (
    <div className="mt-3 rounded-[18px] border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-extrabold text-navy">Incassi mese per mese</h3>
        <span className="text-xs font-medium text-muted">
          {conIncassi === 0
            ? "Ancora nessun incasso registrato"
            : `${eur(totale)} in ${conIncassi} ${conIncassi === 1 ? "mese" : "mesi"} · clicca una barra per vedere chi`}
        </span>
      </div>

      <div className="mt-4 flex items-end gap-1.5" style={{ height: 132 }}>
        {mesi.map((m) => {
          // Anche un mese piccolo deve restare visibile: sotto una certa
          // altezza la barra sparisce e il mese sembra assente invece che magro.
          const altezza = m.totaleCents > 0 ? Math.max(6, Math.round((m.totaleCents / massimo) * 100)) : 2;
          return (
            <Link
              key={m.chiave}
              href={`/admin/numeri/incassato-mese?mese=${m.chiave}${prova ? "&prova=1" : ""}`}
              title={`${m.nome}: ${eur(m.totaleCents)} · ${m.quanti} ${m.quanti === 1 ? "incasso" : "incassi"}`}
              aria-label={`${m.nome}: ${eur(m.totaleCents)} da ${m.quanti} ${m.quanti === 1 ? "incasso" : "incassi"}. Apri l'elenco.`}
              className="group flex flex-1 flex-col items-center justify-end gap-1.5"
              style={{ height: "100%" }}
            >
              <span className="font-display text-[10px] font-extrabold text-navy/70 opacity-0 transition-opacity group-hover:opacity-100">
                {m.totaleCents > 0 ? eur(m.totaleCents) : ""}
              </span>
              <span
                className={`w-full rounded-t-[6px] transition-colors ${
                  m.totaleCents === 0
                    ? "bg-navy/10"
                    : m.corrente
                      ? "bg-gradient-to-t from-blue to-cyan"
                      : "bg-[#1F8A5B]/70 group-hover:bg-[#1F8A5B]"
                }`}
                style={{ height: `${altezza}%` }}
              />
              <span className={`font-display text-[10px] font-bold ${m.corrente ? "text-navy" : "text-muted"}`}>
                {m.etichetta}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
