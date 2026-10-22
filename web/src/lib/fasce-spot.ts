/** Quanto dura una fascia aperta fuori dal calendario generale.
 *
 *  Il calendario generale è una regola: vale per tutti e non scade. Quello che
 *  si apre per un caso singolo è un'eccezione, e un'eccezione senza una fine
 *  diventa una regola che nessuno ha deciso — è così che il lunedì è diventato
 *  un giorno di ritiro.
 *
 *  Nessuna fascia si può assegnare a una persona: la vedono tutti i clienti
 *  del suo servizio. Quindi la domanda da fare a chi la apre non è «per chi»,
 *  ma «fino a quando».
 *
 *  Modulo puro: calcola solo date, e le date sbagliate si scoprono in un test,
 *  non in calendario. */

export type Durata = "sempre" | "settimana" | "data";

export const DURATA_LABEL: Record<Durata, string> = {
  sempre: "Per sempre — entra nel calendario generale",
  settimana: "Solo questa settimana",
  data: "Fino al…",
};

/** La domenica della settimana in cui cade `oggi`, in ora di Roma, come
 *  `YYYY-MM-DD`. La settimana lavorativa finisce lì: un'eccezione «di questa
 *  settimana» non deve sopravvivere al lunedì dopo. */
export function fineSettimana(oggiIso: string): string {
  const d = new Date(`${oggiIso}T12:00:00Z`);
  // 0 = domenica. Quanti giorni mancano alla domenica di questa settimana,
  // contando il lunedì come primo giorno.
  const dow = d.getUTCDay();
  const mancano = dow === 0 ? 0 : 7 - dow;
  d.setUTCDate(d.getUTCDate() + mancano);
  return d.toISOString().slice(0, 10);
}

/** La scadenza da scrivere sulla fascia, a partire dalla scelta del form.
 *  `null` = non scade, cioè è calendario generale. */
export function scadenzaDi(durata: Durata, oggiIso: string, finoAl?: string | null): string | null {
  if (durata === "sempre") return null;
  if (durata === "settimana") return fineSettimana(oggiIso);
  const d = (finoAl ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** È una fascia spot da riequilibrare? Lo è quando la sua data è passata, o
 *  quando è spot senza scadenza — che vuol dire «ci siamo dimenticati di
 *  decidere se tenerla». */
export function daRiequilibrare(
  s: { spot: boolean; vale_fino_al: string | null },
  oggiIso: string,
): boolean {
  if (!s.spot) return false;
  if (!s.vale_fino_al) return true;
  return s.vale_fino_al < oggiIso;
}

/** Come si legge in pannello la durata di una fascia spot. */
export function scadenzaTesto(vale_fino_al: string | null): string {
  if (!vale_fino_al) return "senza scadenza — da decidere se tenerla";
  return `fino al ${vale_fino_al.slice(8, 10)}/${vale_fino_al.slice(5, 7)}/${vale_fino_al.slice(0, 4)}`;
}
