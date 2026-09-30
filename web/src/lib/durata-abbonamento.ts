/** Durata di un abbonamento venduto una volta sola.
 *
 *  Una prova a pagamento — «1 sacco, 1 settimana, 40 €» — non è un incasso
 *  singolo: è un abbonamento vero, con tutte le funzionalità, che però deve
 *  finire da solo. Senza «finire da solo» qualcuno dovrebbe disdire a mano
 *  ogni prova, una persona alla volta, il giorno giusto. Su cento prove è il
 *  passaggio che salta.
 *
 *  La durata si esprime **nel prezzo Stripe**: un solo ciclo di fatturazione
 *  lungo N settimane. Si incassa all'inizio, dentro il periodo non succede
 *  niente, e la disdetta a fine ciclo chiude tutto senza un secondo addebito.
 *
 *  `null` = abbonamento normale, mensile, che si rinnova: è il caso storico e
 *  lo stato di tutti quelli già esistenti. */

/** Le durate proposte nel menu. Un elenco chiuso e non un campo libero: la
 *  durata finisce dentro un prezzo Stripe, e un refuso lì si scopre solo
 *  dall'estratto conto del cliente. */
export const DURATE = [1, 2, 3, 4] as const;

/** Il limite oltre il quale Stripe non accetta un intervallo settimanale. */
const MAX_SETTIMANE = 52;

export type Ricorrenza = { interval: "month" | "week"; interval_count: number };

/** Il pezzo `recurring` del prezzo Stripe. */
export function ricorrenza(settimane: number | null): Ricorrenza {
  const n = settimaneValide(settimane);
  return n ? { interval: "week", interval_count: n } : { interval: "month", interval_count: 1 };
}

/** Come si dice la cadenza accanto a un importo: «45,00 €/mese», «40,00 € per
 *  1 settimana». Sta qui perché la stessa frase serve nel form, nel riquadro
 *  della proposta e nella mail, e tre copie sono tre occasioni di divergere. */
export function cadenzaTesto(settimane: number | null): string {
  const n = settimaneValide(settimane);
  if (!n) return "/mese";
  return n === 1 ? " per 1 settimana" : ` per ${n} settimane`;
}

/** Numero di settimane accettabile, o `null` se non è una durata a termine.
 *  Accetta anche la stringa che arriva da un `<select>` o da un form. */
export function settimaneValide(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.trim()) : typeof v === "number" ? v : NaN;
  if (!Number.isInteger(n) || n < 1 || n > MAX_SETTIMANE) return null;
  return n;
}

/** Un abbonamento a termine ha una data di fine, ed è quella del primo ciclo.
 *  Serve per dirla al cliente prima ancora che Stripe la confermi. */
export function fineDelCiclo(inizioIso: string, settimane: number): string {
  const inizio = new Date(inizioIso);
  return new Date(inizio.getTime() + settimane * 7 * 86_400_000).toISOString();
}
