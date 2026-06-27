import "server-only";

/** Client minimale per l'API transazionale Brevo (v3). Sola lettura: stato
 *  invii email (consegnata/aperta/bounce…). Best-effort: se la key manca o
 *  l'API risponde male, ritorna lista vuota + errore, niente crash. */

const BASE = "https://api.brevo.com/v3";

export type BrevoEvent = {
  email: string;
  date: string;
  subject: string | null;
  event: string;   // requests | delivered | opened | clicks | softBounces | hardBounces | blocked | spam | deferred | …
  reason?: string | null;
};

export type BrevoEventsResult = { ok: true; events: BrevoEvent[] } | { ok: false; error: string };

export async function brevoEvents(opts: { limit?: number; email?: string } = {}): Promise<BrevoEventsResult> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, error: "BREVO_API_KEY non configurata" };
  const params = new URLSearchParams({ limit: String(opts.limit ?? 50), sort: "desc" });
  if (opts.email) params.set("email", opts.email);
  try {
    const res = await fetch(`${BASE}/smtp/statistics/events?${params}`, {
      headers: { "api-key": key, accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: `Brevo ${res.status}: ${(body as { message?: string }).message ?? res.statusText}` };
    }
    const data = (await res.json()) as { events?: BrevoEvent[] };
    return { ok: true, events: data.events ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "errore di rete" };
  }
}

/** Sintesi account (crediti rimasti, piano). */
export async function brevoAccount(): Promise<{ ok: true; email: string; credits: number } | { ok: false; error: string }> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, error: "BREVO_API_KEY non configurata" };
  try {
    const res = await fetch(`${BASE}/account`, { headers: { "api-key": key, accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Brevo ${res.status}` };
    const j = (await res.json()) as { email?: string; plan?: { credits?: number }[] };
    return { ok: true, email: j.email ?? "—", credits: j.plan?.[0]?.credits ?? 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "errore di rete" };
  }
}
