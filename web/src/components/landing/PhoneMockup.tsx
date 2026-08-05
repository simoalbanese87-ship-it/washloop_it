/** Visual dell'hero: il telefono con lo stato dell'ordine in tempo reale.
 *  Ricostruito in markup (niente foto): stessi token del sito, nessun asset da
 *  gestire in /public e nessuna immagine stock.
 *  Proporzioni: la scocca sta intorno a 9:19 come un telefono vero — con un
 *  rapporto più tozzo leggeva come una tessera, non come un dispositivo. */

const STEPS = [
  { title: "Ritirato", sub: "Oggi 19:12 · a casa tua", state: "done" as const },
  { title: "In lavaggio", sub: "Lavaggio eco 30° in corso", state: "active" as const },
  { title: "Stiratura & piega", sub: "Stimato entro domani 14:00", state: "next" as const },
  { title: "In consegna", sub: "Te lo riportiamo noi", state: "next" as const },
];

function CheckIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {/* scocca: bordo scuro, così legge come un dispositivo e non come una card */}
      <div className="rounded-[46px] bg-navy-2 p-2.5 shadow-[0_40px_80px_-24px_rgba(0,0,0,.65)] ring-1 ring-white/15">
        {/* schermo */}
        <div className="relative overflow-hidden rounded-[38px] bg-white px-5 pb-9 pt-14">
          {/* isola dinamica */}
          <div className="absolute left-1/2 top-3 h-6 w-24 -translate-x-1/2 rounded-full bg-navy-2" aria-hidden />

          <div className="flex items-center justify-between text-[11px] font-bold text-muted">
            <span>9:41</span>
            <span className="font-display font-extrabold text-navy">WashLoop</span>
          </div>

          <div className="mt-9">
            <div className="text-[11px] font-bold text-muted">Ordine #WL-2048</div>
            <div className="font-display text-xl font-black leading-tight text-navy">I tuoi capi, live</div>
          </div>

          <ol className="mt-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={
                      "flex h-8 w-8 flex-none items-center justify-center rounded-full text-white " +
                      (s.state === "done"
                        ? "bg-blue"
                        : s.state === "active"
                          ? "bg-white text-cyan ring-2 ring-cyan"
                          : "bg-ice text-navy/30 ring-1 ring-line")
                    }
                    aria-hidden
                  >
                    {s.state === "done" ? <CheckIcon /> : <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className={"w-[2px] flex-1 " + (s.state === "done" ? "bg-blue" : "bg-line")} aria-hidden />
                  )}
                </div>
                <div className="pb-10">
                  <div className="font-display text-[15px] font-extrabold leading-none text-navy">{s.title}</div>
                  <div className="mt-1 text-[11px] font-semibold text-muted">{s.sub}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-[20px] bg-grad px-4 py-4 text-center font-display text-sm font-extrabold text-white">
            Notifiche attive 🔔
          </div>

          {/* barra home */}
          <div className="mx-auto mt-7 h-1 w-28 rounded-full bg-navy/15" aria-hidden />
        </div>
      </div>

      {/* badge fluttuante */}
      <div className="absolute -bottom-4 -left-5 flex items-center gap-2.5 rounded-[16px] border border-white/15 bg-navy-2 px-4 py-3 shadow-[0_18px_40px_-14px_rgba(0,0,0,.6)]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan/15 text-cyan" aria-hidden>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <span className="font-display text-xs font-extrabold leading-snug text-white">
          Il tuo tempo torna
          <br />a essere tuo.
        </span>
      </div>
    </div>
  );
}
