/** I ruoli che un account può avere, e quando si possono cambiare.
 *
 *  Il ruolo non è un'etichetta: è la chiave di casa. `admin` vede ogni cliente,
 *  muove i soldi e cancella; `partner` vede solo i sacchi della sua sede, e
 *  senza nomi; `courier` il suo giro; `customer` soltanto sé stesso.
 *
 *  Fino al 23 ottobre 2026 il ruolo si poteva solo **assegnare alla nascita**,
 *  creando un accesso nuovo. Per promuovere una persona che aveva già un
 *  account — con la sua email e la sua password — non c'era nessuna strada
 *  dal pannello: bisognava scriverlo nel database, aggirando il trigger che
 *  protegge quella colonna. Una strada che passa per il database è una strada
 *  che prima o poi qualcuno percorre di fretta.
 *
 *  Modulo puro: le due regole che contano — non chiudersi fuori, non lasciare
 *  l'azienda senza amministratori — si provano senza database. */

export const RUOLI = ["admin", "partner", "courier", "sales", "customer"] as const;
export type Ruolo = (typeof RUOLI)[number];

export const RUOLO_LABEL: Record<Ruolo, string> = {
  admin: "Amministratore",
  partner: "Lavanderia",
  courier: "Rider",
  sales: "Sales",
  customer: "Cliente",
};

/** Cosa vede chi ha questo ruolo: si scrive accanto al menu, perché promuovere
 *  qualcuno senza sapere cosa gli si apre è il modo in cui si regalano i dati
 *  di tutti. */
export const RUOLO_COSA_VEDE: Record<Ruolo, string> = {
  admin: "tutto: clienti, incassi, rimborsi, impostazioni",
  partner: "solo i sacchi della sua sede, senza i nomi dei clienti",
  courier: "solo il suo giro del giorno, con indirizzi e telefoni",
  sales: "i contatti da richiamare, senza i soldi",
  customer: "solo sé stesso",
};

export function isRuolo(v: unknown): v is Ruolo {
  return typeof v === "string" && (RUOLI as readonly string[]).includes(v);
}

/** Perché questo cambio di ruolo non si può fare, o `null` se si può.
 *
 *  Due sole regole, e sono entrambe sulla porta di casa:
 *  - non ci si cambia il ruolo da soli: è il gesto con cui ci si chiude fuori,
 *    e nessuno può riaprire se l'amministratore era uno;
 *  - l'ultimo amministratore non si può declassare: resterebbe un'azienda
 *    senza nessuno che possa rimettere a posto niente. */
export function perchéNoCambioRuolo(input: {
  /** Chi sta premendo il bottone. */
  ioId: string;
  /** Chi viene cambiato. */
  utenteId: string;
  ruoloAttuale: string;
  ruoloNuovo: string;
  /** Quanti amministratori ci sono adesso, questa persona compresa. */
  quantiAdmin: number;
}): string | null {
  if (!isRuolo(input.ruoloNuovo)) return "Ruolo non valido.";
  if (input.ruoloAttuale === input.ruoloNuovo) return "Ha già questo ruolo.";
  if (input.ioId === input.utenteId) {
    return "Non puoi cambiare il ruolo a te stesso: chiedilo a un altro amministratore.";
  }
  if (input.ruoloAttuale === "admin" && input.quantiAdmin <= 1) {
    return "È l'unico amministratore: prima nominane un altro, poi togli il ruolo a questo.";
  }
  return null;
}
