import Link from "next/link";
import type { MeseIncassi } from "@/lib/incassi-mensili";

const eur = (c: number) => "€" + (c / 100).toLocaleString("it-IT", { maximumFractionDigits: 0 });

/** Con i centesimi: serve dove si fa una somma a vista. Arrotondando, tre
 *  numeri interi che si sommano possono sballare di un euro — e un conto che
 *  non torna di un euro è un conto di cui non ci si fida più. */
const eur2 = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

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
  const totaleCanoni = mesi.reduce((t, m) => t + m.canoniCents, 0);
  const totaleExtra = mesi.reduce((t, m) => t + m.extraCents, 0);
  const conIncassi = mesi.filter((m) => m.totaleCents > 0).length;

  return (
    <div className="mt-3 rounded-[18px] border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-extrabold text-navy">Incassi mese per mese</h3>
        <span className="text-xs font-medium text-muted">
          {conIncassi === 0
            ? "Ancora nessun incasso registrato"
            : `Totale ${eur2(totale)} — la somma delle colonne · clicca una barra per vedere chi`}
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

      <div className="mt-4 flex items-end gap-1.5" style={{ height: 172 }}>
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
          // Il valore si scrive dentro la fetta solo se la fetta lo contiene:
          // l'area delle barre è alta ~130px, quindi sotto l'11% il numero
          // uscirebbe dal suo colore e finirebbe sopra quello accanto. Chi
          // resta fuori lo legge comunque nel totale sopra la barra e nelle
          // due righe di riepilogo qui sotto.
          const ciSta = (h: number) => h >= 11;
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
              className="group flex flex-1 flex-col items-center justify-end gap-1"
              style={{ height: "100%" }}
            >
              {/* Il totale del mese, scritto sempre. Prima compariva solo
                  passandoci sopra col mouse: per sapere com'era andato un mese
                  bisognava cercarlo barra per barra, e da un grafico così non
                  si capiva se stavamo crescendo. */}
              <span className="font-display text-[10px] font-extrabold leading-none text-navy">
                {m.totaleCents > 0 ? eur(m.totaleCents) : m.attesoCents > 0 ? "—" : ""}
              </span>
              <div className="flex w-full flex-1 flex-col justify-end">
                {hAttesa > 0 && (
                  <span
                    className="flex w-full items-center justify-center overflow-hidden rounded-t-[6px] border-2 border-dashed border-blue/55 bg-blue/12 font-display text-[9px] font-extrabold leading-none text-blue"
                    style={{ height: `${hAttesa}%` }}
                  >
                    {ciSta(hAttesa) ? eur(m.attesoCents) : ""}
                  </span>
                )}
                {hExtra > 0 && (
                  <span
                    className={`flex w-full items-center justify-center overflow-hidden bg-cyan/70 font-display text-[9px] font-extrabold leading-none text-navy transition-colors group-hover:bg-cyan ${hAttesa > 0 ? "" : "rounded-t-[6px]"}`}
                    style={{ height: `${hExtra}%` }}
                  >
                    {ciSta(hExtra) ? eur(m.extraCents) : ""}
                  </span>
                )}
                {hCanoni > 0 && (
                  <span
                    className={`flex w-full items-center justify-center overflow-hidden bg-[#1F8A5B]/75 font-display text-[9px] font-extrabold leading-none text-white transition-colors group-hover:bg-[#1F8A5B] ${hAttesa === 0 && hExtra === 0 ? "rounded-t-[6px]" : ""}`}
                    style={{ height: `${hCanoni}%` }}
                  >
                    {ciSta(hCanoni) ? eur(m.canoniCents) : ""}
                  </span>
                )}
                {vuoto && <span className="w-full rounded-t-[6px] bg-navy/10" style={{ height: "2%" }} />}
              </div>
              <span className={`font-display text-[10px] font-bold leading-none ${m.corrente ? "text-navy" : "text-muted"}`}>
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

      {/* Il conto che chiude: il numero generale e di cosa è fatto. Senza, il
          totale in alto e le colonne restano due cose da sommare a mente. */}
      {conIncassi > 0 && (
        <p className="mt-3 border-t border-line pt-3 text-xs font-medium text-muted">
          <strong className="font-display text-sm font-extrabold text-navy">{eur2(totale)}</strong> in tutto ={" "}
          <strong className="text-navy">{eur2(totaleCanoni)}</strong> di abbonamenti +{" "}
          <strong className="text-navy">{eur2(totaleExtra)}</strong> di extra
          {corrente && corrente.attesoCents > 0 ? `, più ${eur2(corrente.attesoCents)} ancora attesi questo mese` : ""}
        </p>
      )}
    </div>
  );
}
