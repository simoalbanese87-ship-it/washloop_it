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
  // La scala tiene conto anche di quello che deve ancora arrivare: se no la
  // parte attesa del mese in corso uscirebbe dal grafico.
  const massimo = Math.max(1, ...mesi.map((m) => m.canoniCents + m.extraCents + m.attesoCents));
  const corrente = mesi.find((m) => m.corrente);
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

      {/* La barra del mese in corso e' sempre piu' bassa delle altre, e non
          perche' stiamo andando peggio: perche' il mese non e' finito. Il
          tratteggio dice quanto manca all'appello, e da dove viene. */}
      {corrente && corrente.attesoCents > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
          <span className="inline-block h-3 w-5 rounded-[3px] border-2 border-dashed border-blue/55 bg-blue/12" />
          <span>
            <strong className="text-navy">{eur(corrente.attesoCents)}</strong> ancora attesi in {corrente.nome} da{" "}
            {corrente.rinnoviAttesi} {corrente.rinnoviAttesi === 1 ? "rinnovo" : "rinnovi"} gia&apos; programmati ·
            chiuderebbe a <strong className="text-navy">{eur(corrente.totaleCents + corrente.attesoCents)}</strong>
          </span>
        </p>
      )}

      <div className="mt-4 flex items-end gap-1.5" style={{ height: 132 }}>
        {mesi.map((m) => {
          // La barra in pila: sotto i canoni, sopra gli extra, e in cima —
          // tratteggiato — quello che deve ancora arrivare. Un mese fatto di
          // abbonamenti e uno fatto di capi extra non sono la stessa azienda,
          // e un totale solo non lo diceva.
          //
          // Anche una fetta piccola deve restare visibile: sotto una certa
          // altezza sparisce, e il mese sembra assente invece che magro.
          const quota = (c: number) => (c > 0 ? Math.max(4, Math.round((c / massimo) * 100)) : 0);
          const hCanoni = quota(m.canoniCents);
          const hExtra = quota(m.extraCents);
          const hAttesa = quota(m.attesoCents);
          const vuoto = m.totaleCents === 0 && m.attesoCents === 0;
          return (
            <Link
              key={m.chiave}
              href={`/admin/numeri/incassato-mese?mese=${m.chiave}${prova ? "&prova=1" : ""}`}
              title={`${m.nome}: ${eur(m.totaleCents)} — ${eur(m.canoniCents)} di abbonamenti, ${eur(m.extraCents)} di extra${
                m.attesoCents > 0 ? ` · attesi ancora ${eur(m.attesoCents)} da ${m.rinnoviAttesi} rinnovi` : ""
              }`}
              aria-label={`${m.nome}: ${eur(m.totaleCents)}, di cui ${eur(m.canoniCents)} di abbonamenti e ${eur(m.extraCents)} di extra${
                m.attesoCents > 0 ? `, più ${eur(m.attesoCents)} attesi dai rinnovi` : ""
              }. Apri l'elenco.`}
              className="group flex flex-1 flex-col items-center justify-end gap-1.5"
              style={{ height: "100%" }}
            >
              <span className="font-display text-[10px] font-extrabold text-navy/70 opacity-0 transition-opacity group-hover:opacity-100">
                {m.totaleCents > 0 ? eur(m.totaleCents) : ""}
              </span>
              {hAttesa > 0 && (
                <span
                  className="w-full rounded-t-[6px] border-2 border-dashed border-blue/55 bg-blue/12"
                  style={{ height: `${hAttesa}%` }}
                />
              )}
              {hExtra > 0 && (
                <span
                  className={`w-full bg-cyan/70 transition-colors group-hover:bg-cyan ${hAttesa > 0 ? "" : "rounded-t-[6px]"}`}
                  style={{ height: `${hExtra}%` }}
                />
              )}
              {hCanoni > 0 && (
                <span
                  className={`w-full bg-[#1F8A5B]/75 transition-colors group-hover:bg-[#1F8A5B] ${hAttesa === 0 && hExtra === 0 ? "rounded-t-[6px]" : ""}`}
                  style={{ height: `${hCanoni}%` }}
                />
              )}
              {vuoto && <span className="w-full rounded-t-[6px] bg-navy/10" style={{ height: "2%" }} />}
              <span className={`font-display text-[10px] font-bold ${m.corrente ? "text-navy" : "text-muted"}`}>
                {m.etichetta}
              </span>
            </Link>
          );
        })}
      </div>

      {/* La legenda: senza, tre colori sono tre colori. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-[#1F8A5B]/75" /> Abbonamenti incassati
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-cyan/70" /> Extra incassati
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[3px] border-2 border-dashed border-blue/55 bg-blue/12" /> Rinnovi ancora attesi
        </span>
        <span>I rimborsi sono già tolti.</span>
      </div>
    </div>
  );
}
