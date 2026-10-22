/** Le fasce su cui una ricorrenza settimanale può davvero posarsi.
 *
 *  Il cron abbina una ricorrenza a una fascia per **giorno della settimana e
 *  ora esatta** (`api/cron/recurring`): se nessuna fascia ha quel giorno a
 *  quell'ora, il ritiro non nasce — e non nasce in silenzio, perché non è un
 *  errore di nessuno, è semplicemente un appuntamento con un'ora che non
 *  esiste. È successo: una ricorrenza al martedì alle 09:00 ha smesso di
 *  produrre ritiri il giorno in cui il calendario è passato a lunedì e
 *  mercoledì, e ce ne siamo accorti settimane dopo.
 *
 *  Il modo di non farlo più succedere non è un altro allarme: è non far
 *  scegliere un'ora che non c'è. Il form mostra le combinazioni vere, questo
 *  modulo le calcola, e i test le tengono ferme.
 *
 *  Puro di proposito: la conversione in ora di Roma la fa chi chiama, così qui
 *  non entra né il fuso né il database. */

export type Fascia = { weekday: number; hhmm: string; servizio?: string | null };

/** Le combinazioni giorno+ora che esistono, senza doppioni, in ordine di
 *  settimana: lunedì per primo, domenica per ultima, e a parità di giorno
 *  l'ora più presto prima. Il calendario ripete le stesse fasce ogni
 *  settimana, quindi un mese di fasce le contiene tutte. */
export function fasceDisponibili(slots: Fascia[]): Fascia[] {
  const viste = new Map<string, Fascia>();
  for (const s of slots) {
    if (!Number.isInteger(s.weekday) || s.weekday < 0 || s.weekday > 6) continue;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.hhmm)) continue;
    const k = chiaveFascia(s);
    if (!viste.has(k)) viste.set(k, { weekday: s.weekday, hhmm: s.hhmm, servizio: s.servizio ?? null });
  }
  // Domenica è 0 nel database ma ultima nella settimana di chi lavora.
  const ordine = (w: number) => (w === 0 ? 7 : w);
  return [...viste.values()].sort((a, b) => ordine(a.weekday) - ordine(b.weekday) || a.hhmm.localeCompare(b.hhmm));
}

/** L'identificativo che viaggia nel form: giorno e ora insieme, perché insieme
 *  sono una cosa sola. Separati tornavano a essere due campi liberi che si
 *  possono combinare in un appuntamento inesistente. */
export function chiaveFascia(f: { weekday: number; hhmm: string }): string {
  return `${f.weekday}|${f.hhmm}`;
}

export function leggiChiave(v: string): { weekday: number; hhmm: string } | null {
  const [g, o] = String(v ?? "").split("|");
  const weekday = Number.parseInt(g, 10);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(o ?? "")) return null;
  return { weekday, hhmm: o };
}

/** C'è una fascia per questo giorno a quest'ora? È la domanda che il cron si
 *  fa ogni mattina, fatta prima di scrivere invece che dopo. */
export function fasciaEsiste(weekday: number, hhmm: string, fasce: Fascia[]): boolean {
  return fasce.some((f) => f.weekday === weekday && f.hhmm === hhmm);
}

/** Gli orari di riconsegna che esistono, senza il giorno: il cron cerca la
 *  prima riconsegna a quell'ora dopo che il bucato è pronto, in qualunque
 *  giorno cada. */
export function oreDiConsegna(slots: Fascia[]): string[] {
  const viste = new Set<string>();
  for (const s of slots) if (/^([01]\d|2[0-3]):[0-5]\d$/.test(s.hhmm)) viste.add(s.hhmm);
  return [...viste].sort();
}
