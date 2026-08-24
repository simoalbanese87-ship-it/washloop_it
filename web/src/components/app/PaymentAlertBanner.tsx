/** Barra rossa in cima quando un pagamento è rimasto indietro.
 *
 *  Serviva perché finora il cliente in `past_due` vedeva l'app di chi non si è
 *  mai abbonato: "Attiva un abbonamento", listino piani, nessun accenno alla
 *  fattura aperta. Chi paga da mesi non capiva che cosa fosse successo, e chi
 *  capiva non aveva un posto dove pagare.
 *
 *  Non si può chiudere di proposito: è l'unica cosa che separa il cliente dal
 *  tornare a prenotare, e nasconderla non lo aiuta. Server component: il link
 *  è un link, non serve JavaScript. */
export function PaymentAlertBanner({ payUrl, grave }: { payUrl: string; grave?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#C0392B] px-4 py-2 text-white">
      <span className="min-w-0 font-display text-xs font-extrabold">
        💳 {grave ? "Abbonamento sospeso: fattura non pagata" : "Pagamento non riuscito — i ritiri sono in pausa"}
      </span>
      <a
        href={payUrl}
        className="flex-none rounded-full bg-white/20 px-3 py-1 font-display text-xs font-extrabold text-white"
      >
        Paga ora
      </a>
    </div>
  );
}
