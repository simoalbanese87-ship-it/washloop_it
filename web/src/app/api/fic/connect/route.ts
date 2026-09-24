import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getCurrentProfile } from "@/lib/auth";

/** Primo passo del collegamento a Fatture in Cloud: manda l'admin ad autorizzare.
 *
 *  Senza questo giro il ponte non può funzionare: le API di FIC vogliono un
 *  token OAuth2, e il token si ottiene solo con l'autorizzazione esplicita del
 *  titolare dell'account. Nessuna credenziale del tuo account FIC passa da noi:
 *  la password la digiti sul loro sito, noi riceviamo solo il token. */

export const dynamic = "force-dynamic";

const SCOPES = ["entity.clients:a", "issued_documents.invoices:a", "settings:r"].join(" ");

export async function GET(req: Request) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") return NextResponse.redirect(new URL("/login?next=/admin/incassi", req.url));

  const clientId = process.env.FIC_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.redirect(
      new URL(`/admin/incassi?warn=${encodeURIComponent("Manca FIC_CLIENT_ID: crea l'app su Fatture in Cloud e aggiungi le credenziali su Vercel.")}`, req.url),
    );
  }

  // `state` firmato in un cookie: è ciò che impedisce a un terzo di far
  // completare a te un collegamento verso il SUO account FIC.
  const state = crypto.randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("fic_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });

  const redirectUri = new URL("/api/fic/callback", req.url).toString();
  const authorize = new URL("https://api-v2.fattureincloud.it/oauth/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", SCOPES);
  authorize.searchParams.set("state", state);

  return NextResponse.redirect(authorize.toString());
}
