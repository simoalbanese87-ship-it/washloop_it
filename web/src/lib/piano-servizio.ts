import type { TipoServizio } from "@/lib/tipo-servizio";

/** Che servizio compra chi compra un piano.
 *
 *  Dal 14 ottobre 2026 il solo stiro si vende da solo: è un piano in `plans`
 *  come gli altri tre, e la differenza sta nella colonna `servizio`. Da quella
 *  riga deve discendere tutto il resto — dove va il sacco, quali fasce vede il
 *  cliente in app, in quante ore torna — e il modo in cui ci discende è il
 *  `tipo_servizio` scritto sul profilo quando il pagamento va a buon fine.
 *
 *  Perché il profilo non si riscrive sempre
 *  ----------------------------------------
 *  Un piano di lavanderia dice «lavanderia», ma **non dice quale**: `lava_stira`
 *  e `solo_lavanderia` sono due accordi diversi che l'ops scrive a mano sulla
 *  scheda, e un rinnovo mensile non deve cancellarli. Quindi i piani di
 *  lavanderia non toccano un profilo già compilato: lo riempiono solo quando è
 *  vuoto. Il piano dello stiro invece decide, sempre: chi paga il solo stiro fa
 *  solo stiro, e se prima faceva altro quel passaggio è esattamente la cosa da
 *  registrare.
 *
 *  Modulo puro: è la regola che manda un sacco nel posto sbagliato se sbagliata,
 *  e sta fuori dal database per poterla collaudare. */

export type ServizioPiano = "lavanderia" | "stiro";

/** Il `tipo_servizio` da scrivere sul profilo, o `null` per «lascia com'è».
 *
 *  @param servizioPiano  la colonna `plans.servizio` del piano pagato
 *  @param servizioAttuale il `profiles.tipo_servizio` di adesso */
export function servizioDopoAbbonamento(
  servizioPiano: string | null | undefined,
  servizioAttuale: TipoServizio | string | null | undefined,
): TipoServizio | null {
  if (servizioPiano === "stiro") {
    // Già a posto: non si riscrive per non sporcare la data di modifica a ogni
    // rinnovo.
    return servizioAttuale === "solo_stiro" ? null : "solo_stiro";
  }
  // Piano di lavanderia. Se il cliente ha già un servizio scritto — anche
  // `solo_stiro`, che qui vorrebbe dire che ha cambiato idea e l'ops lo sa — non
  // si tocca: lo si cambia dalla scheda, dove chi lo fa sa perché.
  if (servizioAttuale) return null;
  return "lava_stira";
}
