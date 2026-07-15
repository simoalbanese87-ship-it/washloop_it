/** Spiegazione "Cosa è incluso vs Extra" — riusabile (area cliente + marketing).
 *  Costo fisso = canone mensile (lavaggio+stiratura+ritiro+consegna, N sacchi/sett,
 *  capi ordinari "compreso sacchetto"). Extra = capi speciali addebitati a listino
 *  sulla prossima fattura. Differenziazione icona+colore+testo (non solo colore). */

const CheckIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);
const PlusIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
);

const INCLUSI = [
  "Lavaggio + stiratura",
  "Ritiro 1 volta a settimana",
  "Consegna a domicilio",
  "Capi ordinari: camicie, pantaloni, t-shirt, intimo, biancheria (nel sacco)",
];
const EXTRA = [
  "Capispalla: giacche, cappotti, piumini",
  "Pelle e pelliccia",
  "Piumoni, coperte, completi letto",
  "Scarpe, tappeti, capi voluminosi",
];

export function CostsExplainer() {
  return (
    <section className="rounded-[22px] border border-line bg-white p-5">
      <h2 className="font-display text-base font-extrabold text-navy">Cosa è incluso e cosa è extra</h2>
      <p className="mt-1 text-sm font-medium text-muted">Il canone copre il servizio ordinario. Alcuni capi speciali hanno un costo a parte, addebitato automaticamente sulla fattura del mese.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Incluso nel canone */}
        <div className="rounded-[16px] border border-[#1F8A5B]/25 bg-[#1F8A5B]/[0.06] p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1F8A5B] text-white"><CheckIcon /></span>
            <span className="font-display text-sm font-extrabold text-[#1F8A5B]">Incluso nel canone</span>
          </div>
          <ul className="mt-3 space-y-2">
            {INCLUSI.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm font-medium text-navy">
                <span className="mt-0.5 flex-none text-[#1F8A5B]"><CheckIcon /></span>{t}
              </li>
            ))}
          </ul>
        </div>

        {/* Extra a listino */}
        <div className="rounded-[16px] border border-[#C9881F]/25 bg-[#C9881F]/[0.07] p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#C9881F] text-white"><PlusIcon /></span>
            <span className="font-display text-sm font-extrabold text-[#C9881F]">Extra a listino</span>
          </div>
          <ul className="mt-3 space-y-2">
            {EXTRA.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm font-medium text-navy">
                <span className="mt-0.5 flex-none text-[#C9881F]"><PlusIcon /></span>{t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-xs font-medium text-muted">
        Gli extra li metti in un sacco separato: li riconosciamo, li trattiamo e li addebitiamo secondo il listino (prezzi IVA inclusa). Ti avvisiamo a ogni capo speciale aggiunto.
      </p>
    </section>
  );
}
