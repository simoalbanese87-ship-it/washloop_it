/** "Fiducia, in numeri chiari" — tre blocchi distinti, non un pannello unico.
 *
 *  Il problema del blocco unico era che 1 · 3 · 3 si leggevano come una fila di
 *  cifre intercambiabili. Qui ogni numero ha un'unità accanto e un piccolo
 *  diagramma che lo rende visivo: la settimana con un giorno acceso, i tre
 *  giorni di lavorazione, i tre volumi crescenti. Il numero diventa il titolo
 *  di un fatto, non una statistica generica.
 *
 *  Ritmo: la card centrale è navy e leggermente sollevata su desktop, così i
 *  tre blocchi non leggono come una griglia piatta. Tutto in CSS, nessun JS. */

const GIORNI = ["L", "M", "M", "G", "V", "S", "D"];
const GIORNO_SCELTO = 3; // giovedì, solo esempio visivo

function CardRitiro() {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-white p-7 shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
      <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.22em] text-blue">Ritiro</div>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display text-6xl font-black leading-none tracking-[-0.04em] text-navy">1</span>
        <span className="font-display text-lg font-extrabold text-navy/45">giorno</span>
      </div>

      <p className="mt-3 text-sm font-medium leading-relaxed text-muted">
        fisso di ritiro, scelto da te
      </p>

      {/* la settimana: un giorno acceso, gli altri spenti */}
      <div className="mt-auto flex gap-1.5 pt-7" aria-hidden>
        {GIORNI.map((g, i) => (
          <span
            key={i}
            className={
              "flex h-8 flex-1 items-center justify-center rounded-[9px] font-display text-[11px] font-extrabold transition-colors duration-300 " +
              (i === GIORNO_SCELTO
                ? "bg-grad text-white shadow-[var(--shadow-cy)]"
                : "bg-ice text-navy/25 group-hover:text-navy/40")
            }
          >
            {g}
          </span>
        ))}
      </div>
    </article>
  );
}

function CardRiconsegna() {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[24px] bg-navy p-7 text-white shadow-[var(--shadow-md)] transition-all duration-300 hover:-translate-y-1 md:-translate-y-3 md:hover:-translate-y-4">
      {/* alone cyan in alto a destra, per dare profondità al navy pieno */}
      <span
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan/20 blur-2xl"
        aria-hidden
      />

      <div className="relative flex flex-1 flex-col">
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.22em] text-cyan">Riconsegna</div>

        <div className="mt-5 flex items-baseline gap-2">
          <span className="font-display text-6xl font-black leading-none tracking-[-0.04em] text-cyan">3</span>
          <span className="font-display text-lg font-extrabold text-white/55">giorni feriali</span>
        </div>

        <p className="mt-3 text-sm font-medium leading-relaxed text-white/60">
          al massimo, dal ritiro all&apos;armadio
        </p>

        {/* i tre giorni di lavorazione, come una barra di avanzamento */}
        <div className="mt-auto flex items-center gap-2 pt-7" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <span className="h-2 flex-1 rounded-full bg-cyan/70" />
              <span className="font-display text-[11px] font-extrabold text-white/40">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function CardPiani() {
  const barre = [
    { code: "S", h: "h-8", o: "opacity-40" },
    { code: "M", h: "h-12", o: "opacity-70" },
    { code: "L", h: "h-16", o: "opacity-100" },
  ];
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-white p-7 shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
      <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.22em] text-blue">Volume</div>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display text-6xl font-black leading-none tracking-[-0.04em] text-navy">3</span>
        <span className="font-display text-lg font-extrabold text-navy/45">piani</span>
      </div>

      <p className="mt-3 text-sm font-medium leading-relaxed text-muted">
        per adattare il servizio al tuo volume
      </p>

      {/* S · M · L come volumi crescenti */}
      <div className="mt-auto flex items-end justify-center gap-4 pt-7" aria-hidden>
        {barre.map((b) => (
          <div key={b.code} className="flex flex-col items-center gap-2">
            <span
              className={`w-9 rounded-[8px] bg-grad transition-transform duration-300 group-hover:scale-y-105 ${b.h} ${b.o}`}
              style={{ transformOrigin: "bottom" }}
            />
            <span className="font-display text-[11px] font-extrabold text-navy/45">{b.code}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function TrustBlocks() {
  return (
    <section aria-label="Indicatori di affidabilità del servizio" className="mt-16">
      <h3 className="font-display text-2xl font-black tracking-[-0.02em] text-navy md:text-3xl">
        Fiducia, in numeri chiari.
      </h3>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <CardRitiro />
        <CardRiconsegna />
        <CardPiani />
      </div>

      <div className="mt-9 flex justify-center">
        <a
          href="#richiesta"
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[40px] bg-grad px-7 font-display text-base font-extrabold text-white shadow-[var(--shadow-cy)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105"
        >
          Verifica disponibilità →
        </a>
      </div>
    </section>
  );
}
