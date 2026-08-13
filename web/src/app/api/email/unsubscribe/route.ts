import { NextResponse } from "next/server";
import { disiscriviConToken } from "@/lib/actions/unsubscribe";

/** Disiscrizione "un clic" (RFC 8058).
 *
 *  È l'indirizzo dell'header List-Unsubscribe: Gmail e Outlook ci mandano una
 *  POST quando l'utente preme "Annulla iscrizione" accanto al mittente, senza
 *  aprire nessuna pagina. La risposta deve essere un 200 e basta.
 *
 *  Solo POST, mai GET: i filtri antispam e i client di posta aprono in anticipo
 *  i link contenuti nelle email per controllarli. Se la disiscrizione avvenisse
 *  in GET, un antivirus aziendale disiscriverebbe i destinatari al posto loro,
 *  e nessuno capirebbe perché le email hanno smesso di arrivare. */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const esito = await disiscriviConToken(token);
  // Anche quando il token non è valido rispondiamo 200: il client di posta non
  // saprebbe che farsene di un errore, e un 4xx lo farebbe solo ritentare.
  if (!esito.ok) console.warn("[unsubscribe] token non valido dalla one-click");
  return NextResponse.json({ ok: true });
}

/** Chi arriva qui con il browser viene mandato alla pagina, dove c'è un
 *  pulsante da premere. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/disiscriviti?t=${encodeURIComponent(token)}`, req.url));
}
