"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Un evento del Meta Pixel, sparato una volta sola sulla pagina di conferma.
 *
 *  Il consenso resta la condizione, senza doverlo ricontrollare qui
 *  -------------------------------------------------------------
 *  `fbq` esiste solo se `MetaPixel` ha caricato lo script, e quello si carica
 *  soltanto dopo «Accetta tutti». Chi ha scelto «Solo necessari» non ha la
 *  funzione, e questo componente non fa niente. Una seconda lettura del
 *  consenso qui sarebbe una copia della stessa regola in due posti, cioè il
 *  modo più comodo di farle divergere.
 *
 *  Perché solo sulla pagina di conferma
 *  ------------------------------------
 *  Perché «Lead» deve dire *registrazione salvata*, non *bottone premuto*. Al
 *  clic non si sa ancora se il salvataggio andrà a buon fine, e un evento
 *  sparato lì conterebbe anche i tentativi falliti e i doppi invii — gonfiando
 *  proprio il numero su cui si decide quanto spendere in campagne.
 *
 *  La deduplica
 *  ------------
 *  Un refresh della pagina di conferma non deve contare una seconda
 *  conversione. La chiave sta in `sessionStorage` come per Google Ads, e si
 *  appoggia a un identificativo che cambia a ogni conferma vera: il
 *  `session_id` di Stripe per l'acquisto, il gettone del redirect per il lead.
 *  Senza quell'identificativo l'evento **non parte**: significa che qualcuno ha
 *  aperto l'indirizzo a mano, e non c'è nessuna conversione da contare. */
export function MetaEvent({
  event,
  value,
  /** Parametro del querystring che rende unica questa conferma. */
  chiave = "session_id",
}: {
  event: "Lead" | "Purchase";
  value?: number | null;
  chiave?: string;
}) {
  const params = useSearchParams();

  useEffect(() => {
    if (typeof window.fbq !== "function") return;

    const id = params.get(chiave);
    // Nessun gettone, nessuna conversione: la pagina è stata aperta a mano.
    if (!id) return;

    const key = `wl_fbq_${event}_${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Navigazione privata o storage bloccato: meglio un evento in più che
      // nessun evento, ma non si interrompe niente.
    }

    window.fbq(
      "track",
      event,
      event === "Purchase" && typeof value === "number" && value > 0
        ? { value, currency: "EUR" }
        : undefined,
    );
  }, [params, event, value, chiave]);

  return null;
}
