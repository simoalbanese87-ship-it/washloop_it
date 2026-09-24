/** Quali automazioni esistono, quando dovrebbero girare, e quando è ora di
 *  preoccuparsi.
 *
 *  Il silenzio è il modo in cui questi guasti si presentano
 *  -------------------------------------------------------
 *  Un cron che fallisce lascia un errore e prima o poi qualcuno lo legge. Un
 *  cron che **non parte** non lascia niente: non c'è un errore da cercare, c'è
 *  solo una cosa che non succede. È così che due lavori sono rimasti fermi per
 *  settimane, ed è così che il 20 settembre il riepilogo del mattino è sparito
 *  senza che nessuno se ne accorgesse per quattro giorni.
 *
 *  Qui si mette per iscritto quanto può durare il silenzio prima che diventi un
 *  sintomo. La soglia non è l'intervallo: un lavoro giornaliero che salta un
 *  giro ha già smesso di funzionare, ma un'ora di ritardo può essere Vercel che
 *  accoda. Da qui il margine. */

export type Job = {
  /** Come si chiama nel registro e nel percorso: /api/cron/<nome>. */
  nome: string;
  /** Cosa fa, detto a chi legge il pannello e non il codice. */
  cosaFa: string;
  /** Quando parte, in ora italiana, per dirlo a schermo. */
  quando: string;
  /** Oltre queste ore senza un giro, è in ritardo. */
  sogliaOre: number;
};

/** L'elenco è scritto a mano di proposito: deve corrispondere a `vercel.json`,
 *  e una riga in più qui che non esiste là (o viceversa) è essa stessa la cosa
 *  da vedere. Le soglie sono l'intervallo più un margine: un giornaliero si
 *  reclama dopo 26 ore, non dopo 24, perché un'ora di coda non è un guasto. */
export const JOBS: Job[] = [
  { nome: "funnel-import", cosaFa: "Porta dentro i lead del funnel", quando: "ogni giorno alle 7:15", sogliaOre: 26 },
  { nome: "recurring", cosaFa: "Crea i ritiri delle ricorrenze settimanali", quando: "ogni giorno alle 8:00", sogliaOre: 26 },
  { nome: "daily-digest", cosaFa: "Manda il riepilogo del mattino", quando: "ogni giorno alle 8:30", sogliaOre: 26 },
  { nome: "dunning", cosaFa: "Solleciti dei pagamenti falliti", quando: "ogni giorno alle 10:00", sogliaOre: 26 },
  { nome: "reminders", cosaFa: "Promemoria del ritiro di domani", quando: "ogni giorno alle 18:00", sogliaOre: 26 },
];

export type UltimoGiro = { job: string; started_at: string; ok: boolean | null; riassunto: string | null; errore: string | null };

export type StatoJob = Job & {
  ultimo: UltimoGiro | null;
  /** Ore dall'ultimo giro. `null` se non è mai girato. */
  oreFa: number | null;
  /** Fermo da troppo, o mai partito. È la cosa che va guardata. */
  inRitardo: boolean;
  /** L'ultimo giro è finito male. */
  fallito: boolean;
};

/** Lo stato di ogni automazione, dato l'ultimo giro di ciascuna.
 *
 *  «Mai girato» conta come in ritardo, non come «non lo sappiamo»: un lavoro in
 *  elenco che non ha mai lasciato una riga è esattamente il caso che questo
 *  registro esiste per far vedere. */
export function statoAutomazioni(ultimi: UltimoGiro[], adesso: number = Date.now()): StatoJob[] {
  const perJob = new Map<string, UltimoGiro>();
  for (const u of ultimi) {
    const prima = perJob.get(u.job);
    if (!prima || Date.parse(u.started_at) > Date.parse(prima.started_at)) perJob.set(u.job, u);
  }

  return JOBS.map((j) => {
    const ultimo = perJob.get(j.nome) ?? null;
    const t = ultimo ? Date.parse(ultimo.started_at) : NaN;
    const oreFa = Number.isFinite(t) ? (adesso - t) / 3600_000 : null;
    return {
      ...j,
      ultimo,
      oreFa,
      inRitardo: oreFa == null || oreFa > j.sogliaOre,
      fallito: ultimo?.ok === false,
    };
  });
}

/** Quante automazioni chiedono attenzione: ferme o finite male. È il numero che
 *  si mette in cima, perché nessuno legge cinque righe se non gli si dice
 *  prima che una non va. */
export function quanteDaGuardare(stati: StatoJob[]): number {
  return stati.filter((s) => s.inRitardo || s.fallito).length;
}
