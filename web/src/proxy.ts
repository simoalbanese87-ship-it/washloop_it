import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Next 16: `proxy` sostituisce `middleware` (runtime nodejs).
 *  Aggiorna la sessione Supabase e protegge le aree riservate. */

const PROTECTED = ["/app", "/admin", "/courier", "/laundry", "/sales"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s+/g, "") ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/\s+/g, "") ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Una sessione vecchia non è un guasto: è una persona che torna dopo giorni.
  //
  // `getUser()` LANCIA quando il refresh token è scaduto o è stato revocato
  // (`AuthApiError: Invalid Refresh Token`), e senza questo try l'eccezione
  // usciva dal proxy: al posto della pagina di accesso il cliente si trovava
  // davanti una schermata di errore, e pensava che il sito fosse rotto.
  // È già successo a tre persone.
  let user = null;
  let sessioneMarcia = false;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    sessioneMarcia = true;
  }

  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));

  // Porta un amico: chi apre un link di invito si porta dietro il codice anche
  // se non si iscrive subito. Il parametro `?ref=` basta per chi va dritto, ma
  // la maggior parte delle persone apre il link, guarda, chiude, e torna il
  // giorno dopo da sola: senza questo cookie quell'invito sarebbe perso.
  //
  // Cookie di servizio e non di profilazione: contiene un codice cliente nostro,
  // non traccia niente, non esce da qui e scade da solo.
  const invito = path.match(/^\/invita\/(WL-\d{3,})/i);
  if (invito) {
    response.cookies.set("wl_invito", invito[1].toUpperCase(), {
      maxAge: 60 * 60 * 24 * 90,
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    });
  }

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    // I cookie di una sessione morta vanno buttati, altrimenti l'errore si
    // ripresenta a ogni richiesta e la persona resta in un giro chiuso.
    if (sessioneMarcia) {
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith("sb-")) redirect.cookies.delete(c.name);
      }
    }
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)"],
};
