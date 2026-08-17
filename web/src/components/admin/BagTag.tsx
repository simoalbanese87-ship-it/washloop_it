import { Logo } from "@/components/Logo";

/** Tag da attaccare al sacco del cliente.
 *
 *  Contiene SOLO logo, codice cliente e QR. Niente nome, telefono, indirizzo,
 *  niente nome della lavanderia. Non è una scelta estetica: questo cartellino
 *  viaggia col sacco fino al banco della lavanderia, che per contratto non deve
 *  sapere di chi sia il bucato — tutte le viste del portale partner sono
 *  costruite per mostrarle solo `WL-####`, e un'etichetta con nome e indirizzo
 *  butterebbe via quella protezione con del nastro adesivo.
 *
 *  Il QR codifica il codice cliente, che non cambia mai: il tag si stampa una
 *  volta e resta sul sacco per sempre, e lo stesso codice serve sia al ritiro
 *  sia alla riconsegna (è lo stato dell'ordine a dire al rider quale dei due sia). */
export function BagTag({ clientCode, qrDataUrl }: { clientCode: string; qrDataUrl: string }) {
  return (
    <div className="tag flex h-[6.5cm] w-[8.5cm] flex-col justify-between rounded-[10px] border-2 border-navy bg-white p-3">
      <div className="flex items-start justify-between">
        <Logo size={18} />
        <span className="font-mono text-[15px] font-bold tracking-tight text-navy">{clientCode}</span>
      </div>

      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt={`QR ${clientCode}`} className="h-[3.4cm] w-[3.4cm]" />
        <div className="min-w-0">
          <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.12em] text-navy/50">Codice</div>
          <div className="font-mono text-[19px] font-black leading-tight text-navy">{clientCode}</div>
          <p className="mt-1.5 text-[9px] font-semibold leading-snug text-navy/55">
            Non rimuovere: serve a ritiro e riconsegna.
          </p>
        </div>
      </div>

      <p className="text-center text-[8.5px] font-semibold text-navy/45">
        Se trovato, scrivi a info@washloop.it · washloop.it
      </p>
    </div>
  );
}
