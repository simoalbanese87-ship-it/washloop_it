/** Formattazione date/ore sempre in ora italiana (Europe/Rome),
 *  indipendente dal fuso del server (Vercel gira in UTC). */

const TZ = "Europe/Rome";
const L = "it-IT";

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
