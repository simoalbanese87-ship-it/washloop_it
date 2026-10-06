/** Porta un amico: le regole, senza database.
 *
 *  Il codice di invito non è nuovo: è il `client_code` WL-#### che ogni cliente
 *  ha già, unico e immutabile, lo stesso stampato sul sacco. Inventarne un
 *  secondo avrebbe voluto dire due codici da spiegare alla stessa persona.
 *
 *  Qui dentro c'è solo quello che si può sbagliare in silenzio: riconoscere un
 *  codice scritto in un modo diverso, quanto vale una settimana, e se un premio
 *  spetta davvero. Il resto — leggere, scrivere, chiamare Stripe — sta in
 *  `referral.ts`. */

/** Il formato del codice cliente, lo stesso che accetta lo scanner del rider. */
const CODICE = /WL-\d{3,}/i;

/** Riconosce il codice anche dentro un link.
 *
 *  Chi condivide un invito manda `washloop.it/invita/WL-1234`, non `WL-1234`:
 *  se poi quel link finisce incollato in un campo, deve funzionare lo stesso.
 *  È la stessa tolleranza che ha già lo scanner del rider, che accetta sia il
 *  codice sia un URL che finisce col codice. */
export function normalizzaCodice(raw: string | null | undefined): string | null {
  const m = String(raw ?? "").match(CODICE);
  return m ? m[0].toUpperCase() : null;
}

export function codiceValido(raw: string | null | undefined): boolean {
  return normalizzaCodice(raw) !== null;
}

/** Quanto vale una settimana di abbonamento.
 *
 *  Il canone è mensile e il mese si conta in quattro settimane: è la stessa
 *  divisione con cui il listino pubblico calcola il prezzo a sacco. Su uno
 *  Small fa 40,00 €. */
export function valoreSettimana(canoneMensileCents: number | null | undefined): number {
  const c = Number(canoneMensileCents);
  if (!Number.isFinite(c) || c <= 0) return 0;
  return Math.round(c / 4);
}

export type StatoPremio = "maturato" | "sospeso";

export type EsitoPremio =
  | { spetta: false; motivo: string }
  | { spetta: true; stato: StatoPremio; valoreCents: number; motivo: string | null };

/** Se quel premio spetta, quanto vale, e se si può accreditare subito.
 *
 *  «Sospeso» non è un rifiuto: è un premio che esiste ma non ha un numero su
 *  cui calcolarsi — chi ha invitato non ha un canone, perché ha disdetto, è a
 *  consumo o ha comprato un pacchetto a termine. Meglio una riga che aspetta in
 *  pannello che un credito calcolato su un importo inventato. */
export function premioSpettante(input: {
  invitanteId: string;
  invitatoId: string;
  canoneInvitanteCents: number | null | undefined;
}): EsitoPremio {
  const { invitanteId, invitatoId, canoneInvitanteCents } = input;
  if (!invitanteId || !invitatoId) return { spetta: false, motivo: "Manca uno dei due clienti." };
  if (invitanteId === invitatoId) return { spetta: false, motivo: "Non ci si può invitare da soli." };

  const valoreCents = valoreSettimana(canoneInvitanteCents);
  if (valoreCents <= 0) {
    return {
      spetta: true,
      stato: "sospeso",
      valoreCents: 0,
      motivo: "Chi ha invitato non ha un canone su cui calcolare la settimana: decidere a mano.",
    };
  }
  return { spetta: true, stato: "maturato", valoreCents, motivo: null };
}

/** Il link da condividere. Una funzione sola, così non si scrive a mano in
 *  quattro posti con quattro barre diverse. */
export function linkInvito(sito: string, codice: string): string {
  return `${sito.replace(/\/+$/, "")}/invita/${codice.toUpperCase()}`;
}
