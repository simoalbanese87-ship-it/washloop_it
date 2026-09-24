import "server-only";

/** Lettura lead della lista d'attesa dal Google Sheet del funnel, tramite una
 *  Web App Apps Script protetta da token (vedi scripts/funnel-sheet-webapp.gs).
 *  Best-effort: se manca la config o l'endpoint risponde male → errore, niente crash.
 *  Nessun dato personale finisce in URL/log: il token viaggia come parametro verso
 *  l'endpoint privato, la risposta è letta server-side e non è cache-ata. */

export type WaitlistLead = {
  date: string | null;      // ISO se parsabile, altrimenti stringa originale
  dateLabel: string;        // come nel foglio
  name: string;             // nome + cognome
  email: string;
  phone: string;
  address: string;          // indirizzo (+ città se presente)
  id: string;
  sheet: string;            // tab di provenienza
  extra: { label: string; value: string }[]; // Q1..Q5, profilo, pain, ecc.
};

export type WaitlistResult =
  | { ok: true; leads: WaitlistLead[] }
  | { ok: false; error: string };

// Normalizza un'intestazione: minuscolo, senza accenti/spazi/punteggiatura.
function norm(h: string): string {
  return h.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "")   // togli "(Q1)" ecc.
    .replace(/[^a-z0-9]/g, "");
}

// Mappa header → campo noto. Tutto il resto va in `extra`.
const FIELD: Record<string, keyof Pick<WaitlistLead, "email" | "phone" | "id">> = {
  email: "email",
  telefono: "phone",
  id: "id",
  iddb: "id",
};

// dd/mm/yyyy[, hh:mm:ss] → ISO (per ordinamento). Ritorna null se non parsabile.
function parseDate(s: string): string | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, d, mo, y, h = "0", mi = "0", se = "0"] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

type RawSheet = { name: string; rows: Record<string, string>[] };

function toLead(row: Record<string, string>, sheet: string): WaitlistLead {
  let email = "", phone = "", id = "", nome = "", cognome = "", indirizzo = "", citta = "", dateLabel = "";
  const extra: { label: string; value: string }[] = [];

  for (const [rawKey, rawVal] of Object.entries(row)) {
    const value = (rawVal ?? "").trim();
    const k = norm(rawKey);
    if (k === "data" || k === "datiscrizione" || k === "dataiscrizione") { dateLabel = value; continue; }
    if (k === "nome") { nome = value; continue; }
    if (k === "cognome") { cognome = value; continue; }
    if (k === "indirizzo") { indirizzo = value; continue; }
    if (k === "citta") { citta = value; continue; }
    if (k in FIELD) {
      const field = FIELD[k];
      if (field === "email") email = value;
      else if (field === "phone") phone = value;
      else if (field === "id") id = value;
      continue;
    }
    if (value) extra.push({ label: rawKey.trim(), value });
  }

  const address = [indirizzo, citta].filter(Boolean).join(", ");
  return {
    date: dateLabel ? parseDate(dateLabel) : null,
    dateLabel,
    name: [nome, cognome].filter(Boolean).join(" ").trim() || "—",
    email,
    phone,
    address,
    id,
    sheet,
    extra,
  };
}

export async function waitlistLeads(): Promise<WaitlistResult> {
  const base = process.env.FUNNEL_SHEET_URL;
  const token = process.env.FUNNEL_SHEET_TOKEN;
  if (!base || !token) return { ok: false, error: "FUNNEL_SHEET_URL / FUNNEL_SHEET_TOKEN non configurati" };

  const url = `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  try {
    // Apps Script redirige (302 → googleusercontent) prima di servire il JSON: fetch segue di default.
    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    if (!res.ok) return { ok: false, error: `Sheet ${res.status}` };
    const data = (await res.json()) as { ok?: boolean; error?: string; sheets?: RawSheet[] };
    if (!data.ok) return { ok: false, error: data.error || "risposta non valida" };

    const leads: WaitlistLead[] = [];
    for (const sh of data.sheets ?? []) {
      for (const row of sh.rows ?? []) leads.push(toLead(row, sh.name));
    }
    // Più recenti in cima; le date non parsabili restano in fondo mantenendo l'ordine.
    leads.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
    return { ok: true, leads };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "errore di rete" };
  }
}
