import { Logo } from "@/components/Logo";

/** Etichetta da infilare nel porta-etichette del sacco: 15 × 6 cm esatti.
 *
 *  Le misure sono in millimetri e non in `rem` o in percentuali: questo foglio
 *  esiste per essere stampato e infilato in una tasca di plastica di quella
 *  misura precisa, quindi un'etichetta che si adatta allo schermo sarebbe
 *  proprio la cosa sbagliata. A schermo si vede più piccola o più grande a
 *  seconda dello zoom; sulla carta viene 150 × 60 mm.
 *
 *  **Cosa c'è scritto sopra, e perché è cambiato.** Il cartellino precedente
 *  portava solo logo, codice e QR, di proposito: viaggia col sacco fino al
 *  banco della lavanderia, che per contratto non deve sapere di chi sia il
 *  bucato. Ora, su richiesta esplicita, mostra anche nome, cognome e tipo di
 *  abbonamento. È una scelta operativa consapevole — chi maneggia il sacco
 *  riconosce il cliente a colpo d'occhio — ma va saputa: da qui in poi il nome
 *  del cliente arriva in lavanderia insieme al bucato. */
export function EtichettaSacco({
  clientCode,
  qrDataUrl,
  nome,
  abbonamento,
}: {
  clientCode: string;
  qrDataUrl: string;
  nome: string;
  abbonamento: string;
}) {
  return (
    <div
      className="tag flex items-stretch gap-[4mm] overflow-hidden rounded-[3mm] border-2 border-navy bg-white px-[5mm] py-[4mm]"
      style={{ width: "150mm", height: "60mm" }}
    >
      {/* QR: quadrato pieno, il lato lo detta l'altezza disponibile. */}
      <div className="flex flex-none items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt={`QR ${clientCode}`} style={{ width: "44mm", height: "44mm" }} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-[1mm]">
        <div className="flex items-start justify-between gap-[3mm]">
          <Logo size={22} />
          <span className="font-display text-[3.6mm] font-bold text-navy/55">washloop.it</span>
        </div>

        <div className="min-w-0">
          <div className="font-display text-[2.8mm] font-extrabold uppercase tracking-[0.14em] text-navy/45">
            N. Cliente
          </div>
          <div className="font-mono text-[9mm] font-black leading-[1.05] tracking-tight text-navy">{clientCode}</div>

          {/* Il nome può essere lungo: si accorcia con i puntini invece di
              far crescere l'etichetta e sballare la misura della tasca. */}
          <div className="mt-[2mm] truncate font-display text-[5.2mm] font-extrabold leading-tight text-navy">
            {nome}
          </div>
          <div className="truncate font-display text-[3.6mm] font-bold text-navy/60">
            <span className="uppercase tracking-[0.1em] text-navy/40">Abbonamento: </span>
            {abbonamento}
          </div>
        </div>

        <p className="text-[2.6mm] font-semibold text-navy/40">
          Non rimuovere: serve a ritiro e riconsegna · se trovato, scrivi a info@washloop.it
        </p>
      </div>
    </div>
  );
}
