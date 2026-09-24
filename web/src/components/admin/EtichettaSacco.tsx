import { Logo } from "@/components/Logo";

/** Etichetta da infilare nel porta-etichette del sacco: 15 × 6 cm esatti.
 *
 *  Le misure sono in millimetri e non in `rem` o in percentuali: questo foglio
 *  esiste per essere stampato e infilato in una tasca di plastica di quella
 *  misura precisa, quindi un'etichetta che si adatta allo schermo sarebbe
 *  proprio la cosa sbagliata. A schermo si vede più piccola o più grande a
 *  seconda dello zoom; sulla carta viene 150 × 60 mm.
 *
 *  **Due copie, e non sono uguali.** La prima porta nome, cognome e tipo di
 *  abbonamento: serve a chi maneggia il sacco a casa del cliente, che deve
 *  riconoscerlo a colpo d'occhio. La seconda — `conNome={false}` — ha solo
 *  logo, codice e QR, ed è quella che può viaggiare fino al banco della
 *  lavanderia, che per contratto non deve sapere di chi sia il bucato: tutte
 *  le viste del portale partner mostrano solo `WL-####`, e un cartellino col
 *  nome butterebbe via quella protezione con del nastro adesivo. */
export function EtichettaSacco({
  clientCode,
  qrDataUrl,
  nome,
  abbonamento,
  conNome = true,
}: {
  clientCode: string;
  qrDataUrl: string;
  nome: string;
  abbonamento: string;
  /** `false` = copia per la lavanderia: niente nome, niente abbonamento. */
  conNome?: boolean;
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

          {conNome && (
            <>
              {/* Il nome può essere lungo: si accorcia con i puntini invece di
                  far crescere l'etichetta e sballare la misura della tasca. */}
              <div className="mt-[2mm] truncate font-display text-[5.2mm] font-extrabold leading-tight text-navy">
                {nome}
              </div>
              <div className="truncate font-display text-[3.6mm] font-bold text-navy/60">
                <span className="uppercase tracking-[0.1em] text-navy/40">Abbonamento: </span>
                {abbonamento}
              </div>
            </>
          )}
        </div>

        <p className="text-[2.6mm] font-semibold text-navy/40">
          Non rimuovere: serve a ritiro e riconsegna · se trovato, scrivi a info@washloop.it
          {!conNome && <span className="float-right font-bold text-navy/30">copia lavanderia</span>}
        </p>
      </div>
    </div>
  );
}
