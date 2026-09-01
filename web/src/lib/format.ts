/** Formattazione date/ore sempre in ora italiana (Europe/Rome),
 *  indipendente dal fuso del server (Vercel gira in UTC). */

const TZ = "Europe/Rome";
const L = "it-IT";

/** Formatta un importo in cent EUR come "€1.234,50". */
export function eurCents(cents: number): string {
  return "€" + (cents / 100).toLocaleString(L, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(L, { timeZone: TZ });
}

export function fmtDayShort(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(L, { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
}

export function fmtTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString(L, { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function fmtDateTime(iso: string | Date): string {
  return `${fmtDayShort(iso)} · ${fmtTime(iso)}`;
}

export function fmtFull(iso: string | Date): string {
  return `${fmtDate(iso)}, ${fmtTime(iso)}`;
}

export function fmtSlot(start: string | Date, end: string | Date): string {
  return `${fmtDayShort(start)} · ${fmtTime(start)}–${fmtTime(end)}`;
}

/** Fascia oraria senza data: "08:00–10:00". */
export function fmtTimeRange(start: string | Date, end: string | Date): string {
  return `${fmtTime(start)}–${fmtTime(end)}`;
}

/** Chiave giorno stabile in ora di Roma: "YYYY-MM-DD" (per raggruppare gli slot). */
export function romeDayKey(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Giorno della settimana abbreviato in italiano: "mar". */
export function fmtDow(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(L, { timeZone: TZ, weekday: "short" });
}

/** Giorno della settimana esteso in italiano: "martedì". */
export function fmtDowLong(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(L, { timeZone: TZ, weekday: "long" });
}

/** Numero del giorno del mese: "24". */
export function fmtDayNum(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(L, { timeZone: TZ, day: "numeric" });
}

/** Giorno della settimana in ora di Roma come indice 0=domenica … 6=sabato. */
export function romeWeekday(iso: string | Date): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

/** Ora di inizio in ora di Roma, formato "HH:MM" 24h. */
export function romeHHMM(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

/** Nome esteso del giorno della settimana da indice 0=domenica … 6=sabato. */
export const WEEKDAY_IT = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

/** Offset di Europe/Rome rispetto a UTC (ms) all'istante dato. */
function romeOffsetMs(date: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/** "YYYY-MM-DDTHH:mm" inteso come ora di Roma → ISO UTC. */
export function romeLocalToISO(local: string): string | null {
  if (!local) return null;
  const guess = new Date(`${local}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  return new Date(guess.getTime() - romeOffsetMs(guess)).toISOString();
}

/** Valore per <input type="datetime-local"> in ora Europe/Rome. */
export function toRomeInputValue(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Fine della giornata odierna in ora di Roma, in millisecondi.
 *
 *  Serve a tagliare "oggi" da "in futuro" senza dipendere dal fuso del server:
 *  su Vercel `new Date()` è UTC, e per due ore ogni notte il giorno italiano e
 *  quello UTC non coincidono.
 *
 *  Torna un numero e non una stringa di proposito: il confronto va fatto tra
 *  istanti. PostgREST scrive i timestamp come `2026-09-01T07:00:00+00:00`,
 *  `toISOString()` come `2026-09-01T21:59:00.000Z`, e confrontare quelle due
 *  forme come testo funziona per caso finché non smette. */
export function fineGiornataRomaMs(now: Date = new Date()): number {
  const iso = romeLocalToISO(`${romeDayKey(now)}T23:59`);
  return iso ? Date.parse(iso) : now.getTime();
}

/** `true` se l'istante cade oggi o prima, in ora di Roma. Un valore assente
 *  conta come "sì": una fermata senza fascia non va nascosta. */
export function entroOggiRoma(iso: string | null | undefined, now: Date = new Date()): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  return Number.isNaN(t) || t <= fineGiornataRomaMs(now);
}
