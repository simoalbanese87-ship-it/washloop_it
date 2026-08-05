import "server-only";

/** Copia dei lead della landing "/disponibilita" su un Google Sheet, tramite una
 *  Web App Apps Script protetta da token (vedi scripts/leads-sheet-webapp.gs).
 *  È un MIRROR, non la fonte di verità: il lead è già salvo su Supabase quando
 *  questa funzione parte. Quindi non lancia mai e non blocca l'invio del form.
 *
 *  Foglio SEPARATO da quello del funnel (FUNNEL_SHEET_URL): quello viene riletto
 *  da `waitlist.ts` per la dashboard, e scriverci dentro creerebbe doppioni. */

export type LeadSheetRow = {
  createdAt: string;   // ISO
  fullName: string;
  email: string;
  cap: string;
  plan: string;
  covered: boolean;
  zone?: string;       // nome del quadrante (vuoto se il CAP non è mappato)
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export type SheetResult = { ok: true } | { ok: false; error: string };

export async function appendLeadToSheet(row: LeadSheetRow): Promise<SheetResult> {
  const url = process.env.LEADS_SHEET_URL;
  const token = process.env.LEADS_SHEET_TOKEN;
  // Env assenti = mirror disattivato di proposito (i lead si consultano in
  // /admin/disponibilita e si esportano in CSV). Niente log: non è un errore.
  if (!url || !token) return { ok: false, error: "non configurato" };

  try {
    // Token e dati personali nel body (mai in querystring: finirebbero nei log).
    // Apps Script risponde 302 verso googleusercontent prima del JSON: fetch segue.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita il preflight lato Apps Script
      body: JSON.stringify({ token, lead: row }),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { ok: false, error: `Sheet ${res.status}` };
    const data = (await res.json()) as { ok?: boolean; error?: string };
    return data.ok ? { ok: true } : { ok: false, error: data.error || "risposta non valida" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "errore di rete" };
  }
}
