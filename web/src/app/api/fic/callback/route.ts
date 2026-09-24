import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

/** Ritorno da Fatture in Cloud: scambia il codice con i token e li salva.
 *
 *  I token finiscono in tabella e non in una variabile d'ambiente perché il
 *  refresh token ruota a ogni rinnovo: una env non è scrivibile a runtime,
 *  quindi al primo rinnovo il collegamento si romperebbe da solo. */

export const dynamic = "force-dynamic";

const vaiA = (req: Request, q: string) => NextResponse.redirect(new URL(`/admin/incassi?${q}`, req.url));

export async function GET(req: Request) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") return NextResponse.redirect(new URL("/login?next=/admin/incassi", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errore = url.searchParams.get("error");

  if (errore) return vaiA(req, `warn=${encodeURIComponent(`Autorizzazione negata: ${errore}`)}`);
  if (!code) return vaiA(req, `warn=${encodeURIComponent("Nessun codice ricevuto da Fatture in Cloud.")}`);

  // Il `state` deve tornare identico a quello che abbiamo emesso: senza questo
  // controllo, un link malevolo potrebbe farci salvare i token di un account
  // altrui, e le fatture finirebbero lì.
  const jar = await cookies();
  const atteso = jar.get("fic_state")?.value;
  jar.delete("fic_state");
  if (!atteso || atteso !== state) return vaiA(req, `warn=${encodeURIComponent("Sessione di collegamento non valida: riprova.")}`);

  const clientId = process.env.FIC_CLIENT_ID?.trim();
  const clientSecret = process.env.FIC_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return vaiA(req, `warn=${encodeURIComponent("Credenziali FIC mancanti sul server.")}`);

  const redirectUri = new URL("/api/fic/callback", req.url).toString();
  const res = await fetch("https://api-v2.fattureincloud.it/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!res.ok) {
    const t = (await res.text()).slice(0, 200);
    return vaiA(req, `warn=${encodeURIComponent(`Scambio del codice fallito: ${t}`)}`);
  }
  const tok = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };

  // L'id dell'azienda serve in ogni chiamata successiva: lo chiediamo ora, così
  // non va né configurato a mano né indovinato.
  let companyId: number | null = parseInt(process.env.FIC_COMPANY_ID ?? "0", 10) || null;
  try {
    const r = await fetch("https://api-v2.fattureincloud.it/user/companies", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const j = await r.json();
    const prima = j?.data?.companies?.[0];
    if (prima?.id) companyId = prima.id;
  } catch {
    /* se non riesce resta quello configurato a mano */
  }

  const svc = createServiceClient();
  const { error } = await svc.from("fic_tokens").upsert(
    {
      id: 1,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
      company_id: companyId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) return vaiA(req, `warn=${encodeURIComponent(`Token non salvati: ${error.message}`)}`);

  return vaiA(req, `ok=${encodeURIComponent("Fatture in Cloud collegato.")}`);
}
