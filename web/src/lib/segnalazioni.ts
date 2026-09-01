/** Segnalazioni della lavanderia sui capi.
 *
 *  Il tipo non è una categoria decorativa: decide chi viene avvisato e quando.
 *  Sta in un file senza dipendenze così la regola è verificabile da un test
 *  unitario (il runner di Node non conosce l'alias `@/`).
 */

export const TIPI_SEGNALAZIONE = ["trovato_cosi", "non_rimosso", "danno"] as const;

export type TipoSegnalazione = (typeof TIPI_SEGNALAZIONE)[number];

export function isTipoSegnalazione(v: string): v is TipoSegnalazione {
  return (TIPI_SEGNALAZIONE as readonly string[]).includes(v);
}

/** Etichetta breve, quella che si legge in cima alla segnalazione. */
export const SEGNALAZIONE_LABEL: Record<TipoSegnalazione, string> = {
  trovato_cosi: "Arrivato già così",
  non_rimosso: "Non è venuto via",
  danno: "Danno in lavorazione",
};

/** Cosa vuol dire, detto a chi sta scegliendo sul banco della lavanderia. */
export const SEGNALAZIONE_AIUTO: Record<TipoSegnalazione, string> = {
  trovato_cosi: "Il capo era già macchiato, strappato o scolorito quando avete aperto il sacco.",
  non_rimosso: "Avete lavato ma la macchia o l'alone è rimasto.",
  danno: "Il capo si è rovinato durante la lavorazione da voi.",
};

/** Come la stessa cosa viene raccontata al cliente. Non è la frase della
 *  lavanderia con altre parole: è il contesto che la lavanderia non può dare —
 *  di chi è la responsabilità e cosa succede adesso. */
export const SEGNALAZIONE_AL_CLIENTE: Record<TipoSegnalazione, string> = {
  trovato_cosi: "La lavanderia ha trovato questo capo già segnato quando ha aperto il sacco.",
  non_rimosso: "Abbiamo provato a smacchiarlo, ma il segno non è andato via del tutto.",
  danno: "Questo capo si è rovinato mentre era da noi. Ce ne occupiamo noi.",
};

/** Tono con cui mostrare la segnalazione. Il danno è nostro: si vede. */
export const SEGNALAZIONE_TONO: Record<TipoSegnalazione, "neutro" | "attenzione" | "grave"> = {
  trovato_cosi: "neutro",
  non_rimosso: "attenzione",
  danno: "grave",
};

/** Chi viene avvisato subito.
 *
 *  `trovato_cosi` e `non_rimosso` partono verso il cliente appena scritte:
 *  dirgli in ritardo che il capo era già rovinato non serve a niente, e
 *  avvisarlo della macchia rimasta DOPO che ha aperto il sacco è peggio che
 *  non avvisarlo.
 *
 *  `danno` no. È un'ammissione di responsabilità, e va al cliente insieme a
 *  cosa gli proponiamo — rimborso, rilavaggio, sostituzione. Nasce quindi non
 *  pubblicata: la vede l'ops, che la pubblica quando ha deciso. */
export function avvisaSubitoIlCliente(tipo: TipoSegnalazione): boolean {
  return tipo !== "danno";
}

/** La foto è la prova. Su un danno è obbligatoria: senza, fra un mese non c'è
 *  modo di sapere cosa fosse successo. Sugli altri è caldamente consigliata,
 *  ma non si blocca chi ha le mani bagnate e il telefono in tasca. */
export function fotoObbligatoria(tipo: TipoSegnalazione): boolean {
  return tipo === "danno";
}

/** Stati dell'ordine in cui la lavanderia può segnalare: da quando il sacco è
 *  suo fino a quando è tornato al cliente. Un danno può saltare fuori anche
 *  mentre il sacco aspetta il rider, quindi il taglio NON è quello dei capi
 *  speciali (`LAVORAZIONE_APERTA`), che si fermano a «pronto». */
export const SEGNALABILE: string[] = [
  "picked_up",
  "at_laundry",
  "washing",
  "ready",
  "delivery_scheduled",
  "out_for_delivery",
];
