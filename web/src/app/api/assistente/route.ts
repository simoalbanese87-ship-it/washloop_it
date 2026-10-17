import { NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";
import { after } from "next/server";
import { rispondi, registraDomanda, type Turno } from "@/lib/assistente";

/** Il riquadro «Domande?» del sito.
 *
 *  Qui resta solo quello che riguarda **questa porta**: il limite per indirizzo
 *  IP, la lunghezza della domanda e la forma della risposta. Le istruzioni, il
 *  contesto e la chiamata al modello stanno in `lib/assistente.ts`, perché
 *  serviranno anche alla conversazione WhatsApp: due copie dello stesso
 *  contesto vorrebbero dire due assistenti che, dopo il primo cambio di
 *  listino, raccontano due servizi diversi. */

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_DOMANDA = 500;
const MAX_ORA = 20;
const MAX_TURNI = 6;

/** Richieste per IP nell'ultima ora, tenute in memoria del processo.
 *  Non è una difesa perfetta — le funzioni serverless non condividono memoria —
 *  ma ferma il caso concreto: qualcuno che tiene premuto invio. */
const contatore = new Map<string, { n: number; da: number }>();

function troppeRichieste(chiave: string): boolean {
  const ora = Date.now();
  const c = contatore.get(chiave);
  if (!c || ora - c.da > 3_600_000) {
    contatore.set(chiave, { n: 1, da: ora });
    return false;
  }
  c.n++;
  return c.n > MAX_ORA;
}

/** Lo storico arriva dal browser, quindi è materiale di cui non ci si fida:
 *  si prendono solo gli ultimi turni, accorciati, e con i due soli ruoli
 *  previsti. Senza questo filtro, chi vuole può incollare nel «passato» della
 *  conversazione le istruzioni che preferisce. */
function storicoPulito(grezzo: unknown): Turno[] {
  if (!Array.isArray(grezzo)) return [];
  return grezzo
    .slice(-MAX_TURNI)
    .filter((t): t is { ruolo: string; testo: string } => !!t && typeof t === "object")
    .map((t) => ({
      ruolo: t.ruolo === "assistente" ? ("assistente" as const) : ("utente" as const),
      testo: String(t.testo ?? "").slice(0, MAX_DOMANDA),
    }))
    .filter((t) => t.testo.length > 0);
}

export async function POST(req: Request) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "anonimo";
  const idIp = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
  if (troppeRichieste(idIp)) {
    return NextResponse.json({ errore: "Hai fatto molte domande di fila: riprova tra poco." }, { status: 429 });
  }

  let domanda = "";
  let storico: Turno[] = [];
  try {
    const body = (await req.json()) as { domanda?: string; storico?: unknown };
    domanda = String(body.domanda ?? "").trim().slice(0, MAX_DOMANDA);
    storico = storicoPulito(body.storico);
  } catch {
    return NextResponse.json({ errore: "Richiesta non valida." }, { status: 400 });
  }
  if (domanda.length < 3) return NextResponse.json({ errore: "Scrivi una domanda un po' più lunga." }, { status: 400 });

  const esito = await rispondi({ domanda, canale: "sito", storico });

  if (!esito.ok) {
    return NextResponse.json({ errore: esito.errore }, { status: esito.stato });
  }

  // La traccia si scrive dopo la risposta: chi ha chiesto non deve aspettare
  // una insert, e una insert fallita non deve togliere una risposta buona.
  after(() => registraDomanda({ canale: "sito", domanda, risposta: esito.risposta, nonLoSo: esito.nonLoSo }));

  return NextResponse.json({ risposta: esito.risposta });
}
