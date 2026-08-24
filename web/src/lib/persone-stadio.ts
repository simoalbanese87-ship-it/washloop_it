/** Vocabolario degli stadi e regola che li assegna.
 *
 *  Sta fuori da `persone.ts` perché quel file importa `server-only`: la regola
 *  è la cosa che sbaglia più facilmente e va potuta collaudare senza database e
 *  senza Next. `persone.ts` la riesporta, così chi la usa non deve sapere che
 *  vive qui.
 *
 *  Gli stadi sono quattro. "Registrato" c'era e non voleva dire niente: chi ha
 *  aperto un account senza mai pagare è un contatto caldo — un lead con
 *  l'account — non una categoria a parte, e si lavora con le stesse azioni. */

export const STADI = ["lead", "attivo", "difficolta", "perso"] as const;
export type Stadio = (typeof STADI)[number];

export const STADIO_LABEL: Record<Stadio, string> = {
  lead: "Lead",
  attivo: "Cliente attivo",
  difficolta: "Pagamento fallito",
  perso: "Cliente perso",
};

export const STADIO_TONO: Record<Stadio, string> = {
  lead: "bg-navy/10 text-navy/70",
  attivo: "bg-[#1F8A5B]/12 text-[#1F8A5B]",
  difficolta: "bg-[#C0392B]/12 text-[#C0392B]",
  perso: "bg-[#C9881F]/12 text-[#C9881F]",
};

const ATTIVI = ["active", "trialing"];

/** Attivo davvero: non basta `status='active'`, il periodo pagato deve ancora
 *  correre. Senza il secondo controllo un abbonamento scaduto a luglio
 *  continuava a contare nel ricorrente del mese. */
export const vivo = (status: string, fine: string | null, adesso: number = Date.now()) =>
  ATTIVI.includes(status) && (!fine || new Date(fine).getTime() >= adesso);

/** Lo stadio di chi ha un profilo, a partire dalla sua ultima subscription.
 *  `null` = nessuna subscription: si è registrato e non ha mai pagato. */
export function stadioDaSubscription(
  sub: { status: string; current_period_end: string | null } | null | undefined,
  adesso: number = Date.now(),
): Stadio {
  if (!sub) return "lead";
  if (vivo(sub.status, sub.current_period_end, adesso)) return "attivo";
  if (sub.status === "past_due" || sub.status === "unpaid") return "difficolta";
  // Un checkout aperto e mai concluso non è un cliente perso: è rimasto un lead.
  if (sub.status === "incomplete" || sub.status === "incomplete_expired") return "lead";
  return "perso";
}
