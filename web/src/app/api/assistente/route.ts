import { NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";
import { contestoAssistente } from "@/lib/faq";
import { createServiceClient } from "@/lib/supabase/server";

/** Assistente per le domande dei clienti, basato sulle FAQ.
 *
 *  Regola di fondo: risponde SOLO da FAQ, informazioni di servizio e contatti.
 *  Non riceve dati personali, non vede ordini, non sa chi sta scrivendo — è
 *  una scelta di progetto, non una limitazione tecnica: un assistente che
 *  legge gli ordini è un altro lavoro, con altre precauzioni sulla privacy.
 *
 *  Se la domanda esce dal materiale che ha, deve dirlo e rimandare a noi:
 *  meglio un «questo non lo so, scrivici» che una risposta inventata su
 *  prezzi, tempi o rimborsi. */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODELLO = "claude-sonnet-5";
const MAX_DOMANDA = 500;
const MAX_ORA = 20;

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

const ISTRUZIONI = `Sei l'assistente di WashLoop, servizio di lavanderia a domicilio a Milano.

REGOLE, in ordine di importanza:
1. Rispondi ESCLUSIVAMENTE usando le informazioni qui sotto. Non inventare prezzi, tempi, coperture, condizioni o politiche di rimborso.
2. Se la risposta non è nel materiale, dillo con semplicità e invita a scrivere a info@washloop.it. Non tentare di indovinare.
3. Non chiedere e non usare dati personali. Se qualcuno ti scrive nome, indirizzo, numero d'ordine o dati di pagamento, non ripeterli e spiega che da qui non puoi vedere gli ordini: per quello serve l'area personale o scriverci.
4. Rispondi in italiano, con il tu, in poche righe. Niente elenchi lunghi se bastano due frasi.
5. Non promettere nulla a nome dell'azienda: rimborsi, eccezioni e reclami si trattano scrivendo a noi.`;

export async function POST(req: Request) {
  const chiave = process.env.ANTHROPIC_API_KEY?.trim();
  if (!chiave) {
    return NextResponse.json(
      { errore: "Assistente non configurato. Scrivici a info@washloop.it e ti rispondiamo noi." },
      { status: 503 },
    );
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "anonimo";
  const idIp = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
  if (troppeRichieste(idIp)) {
    return NextResponse.json({ errore: "Hai fatto molte domande di fila: riprova tra poco." }, { status: 429 });
  }

  let domanda = "";
  try {
    const body = (await req.json()) as { domanda?: string };
    domanda = String(body.domanda ?? "").trim().slice(0, MAX_DOMANDA);
  } catch {
    return NextResponse.json({ errore: "Richiesta non valida." }, { status: 400 });
  }
  if (domanda.length < 3) return NextResponse.json({ errore: "Scrivi una domanda un po' più lunga." }, { status: 400 });

  // Zone coperte lette dal database, le stesse che usa la landing per dire
  // "sei in zona". Con il testo scritto a mano nelle FAQ l'assistente aveva
  // appena risposto che Rozzano probabilmente non era coperta, mentre lo è.
  let copertura = "";
  try {
    const { data } = await createServiceClient()
      .from("zone_caps")
      .select("cap, zones!inner(name, active)")
      .eq("zones.active", true)
      .returns<{ cap: string; zones: { name: string } | null }[]>();
    const caps = [...new Set((data ?? []).map((z) => z.cap))].sort();
    const zone = [...new Set((data ?? []).map((z) => z.zones?.name).filter(Boolean))];
    if (caps.length) {
      copertura = `\n\nZONE COPERTE ADESSO (fonte: il nostro sistema, aggiornata): ${zone.join(", ")}. CAP serviti: ${caps.join(", ")}. Se il CAP della persona non è in questo elenco, non siamo ancora attivi da lei: invitala a lasciare il contatto su washloop.it/disponibilita per essere avvisata all'apertura.`;
    }
  } catch {
    /* senza database si risponde comunque, con le sole FAQ */
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chiave,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELLO,
        max_tokens: 400,
        system: `${ISTRUZIONI}\n\n---\n${contestoAssistente()}${copertura}`,
        messages: [{ role: "user", content: domanda }],
      }),
    });

    if (!res.ok) {
      console.error("[assistente] Anthropic ha risposto", res.status, (await res.text()).slice(0, 300));
      return NextResponse.json(
        { errore: "L'assistente non risponde in questo momento. Scrivici a info@washloop.it." },
        { status: 502 },
      );
    }

    const dati = (await res.json()) as { content?: { type: string; text?: string }[] };
    const risposta = (dati.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();

    return NextResponse.json({ risposta: risposta || "Non ho una risposta certa: scrivici a info@washloop.it." });
  } catch (err) {
    console.error("[assistente] errore:", err);
    return NextResponse.json({ errore: "Qualcosa è andato storto. Scrivici a info@washloop.it." }, { status: 500 });
  }
}
