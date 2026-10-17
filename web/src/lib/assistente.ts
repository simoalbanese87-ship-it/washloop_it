import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { contestoAssistente, prezziPerAssistente } from "@/lib/faq";

/** L'assistente che risponde sulle cose del servizio.
 *
 *  Perché sta qui e non dentro la route
 *  ------------------------------------
 *  Perché i lettori saranno due. Oggi lo chiama il riquadro «Domande?» del
 *  sito; domani lo chiamerà la conversazione WhatsApp, che deve rispondere con
 *  le stesse parole e con gli stessi prezzi. Due copie dello stesso contesto
 *  vorrebbero dire due assistenti che, dopo il primo cambio di listino,
 *  raccontano due servizi diversi.
 *
 *  Cosa può dire, e cosa no
 *  ------------------------
 *  Solo il materiale che gli passiamo: FAQ ufficiali, zone coperte e listino,
 *  questi ultimi **letti dal database a ogni domanda**. Non vede ordini, non sa
 *  chi sta scrivendo e non deve ricevere dati personali: è scritto nelle
 *  istruzioni ed è il motivo per cui quelle righe non si toccano per canale.
 *
 *  I due episodi che hanno formato questo file: «Rozzano non è coperta» (lo è)
 *  e «un sacco extra costa 45 €» (non esiste). Nessuno dei due era
 *  un'invenzione del modello: erano due numeri scritti a mano in un file. */

const MODELLO = "claude-sonnet-5";
const MAX_TOKEN_RISPOSTA = 400;

/** Le regole, in ordine di importanza. Valgono su ogni canale: quello che
 *  cambia, sotto, è solo la lunghezza della risposta. */
export const ISTRUZIONI = `Sei l'assistente di WashLoop, servizio di lavanderia a domicilio a Milano.

REGOLE, in ordine di importanza:
1. Rispondi ESCLUSIVAMENTE usando le informazioni qui sotto. Non inventare prezzi, tempi, coperture, condizioni o politiche di rimborso.
2. Se la risposta non è nel materiale, dillo con semplicità e invita a scrivere a info@washloop.it. Non tentare di indovinare.
3. Non chiedere e non usare dati personali. Se qualcuno ti scrive nome, indirizzo, numero d'ordine o dati di pagamento, non ripeterli e spiega che da qui non puoi vedere gli ordini: per quello serve l'area personale o scriverci.
4. Rispondi in italiano, con il tu, in poche righe. Niente elenchi lunghi se bastano due frasi.
5. Non promettere nulla a nome dell'azienda: rimborsi, eccezioni e reclami si trattano scrivendo a noi.`;

/** La coda delle istruzioni che cambia con il canale.
 *
 *  Su WhatsApp si legge da un telefono, spesso in piedi: tre righe sono già
 *  tante, e un elenco puntato è illeggibile. Le cinque regole di sopra restano
 *  identiche — quelle non si adattano al mezzo. */
const PER_CANALE: Record<Canale, string> = {
  sito: "",
  whatsapp:
    "\n6. Questo messaggio arriva su WhatsApp: rispondi in due o tre righe, senza elenchi puntati e senza formattazione. Se la risposta è lunga, dai la parte che serve e offri di spiegare il resto.",
};

export type Canale = "sito" | "whatsapp";

export type Turno = { ruolo: "utente" | "assistente"; testo: string };

/** Il contesto che cambia: zone servite e listino, letti dal database.
 *
 *  Non si tiene in cache. Due query per domanda non pesano niente, mentre una
 *  cache è il modo esatto per rimettere in giro il prezzo vecchio — che è il
 *  bug che questo codice esiste per non ripetere. */
export async function contestoDinamico(): Promise<string> {
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

  let prezzi = "";
  try {
    const svc = createServiceClient();
    const [{ data: piani }, { data: capi }] = await Promise.all([
      svc
        .from("plans")
        .select("name, price_month_cents, bags_per_week")
        .eq("active", true)
        .order("sort")
        .returns<{ name: string; price_month_cents: number; bags_per_week: number }[]>(),
      svc
        .from("special_items")
        .select("name, price_cli_cents, incluse_per_sacco")
        .eq("active", true)
        .order("name")
        .returns<{ name: string; price_cli_cents: number; incluse_per_sacco: number }[]>(),
    ]);
    prezzi = prezziPerAssistente({
      piani: (piani ?? []).map((p) => ({ nome: p.name, prezzoMeseCents: p.price_month_cents, sacchiSettimana: p.bags_per_week })),
      capi: (capi ?? []).map((c) => ({ nome: c.name, prezzoCents: c.price_cli_cents, inclusePerSacco: c.incluse_per_sacco })),
    });
  } catch {
    /* senza listino si risponde comunque: le FAQ non contengono più prezzi */
  }

  return `${contestoAssistente()}${copertura}${prezzi}`;
}

export type EsitoAssistente =
  | { ok: true; risposta: string; nonLoSo: boolean }
  | { ok: false; errore: string; stato: number };

/** Frasi con cui il modello ammette di non sapere. Servono a contarle: se una
 *  domanda ricorrente finisce sempre qui, manca una FAQ — ed è l'unico modo per
 *  accorgersene senza leggere ogni conversazione. */
function sembraNonLoSo(testo: string): boolean {
  const t = testo.toLowerCase();
  return (
    t.includes("non ho questa informazione") ||
    t.includes("non ho una risposta") ||
    t.includes("non lo so") ||
    t.includes("non saprei") ||
    (t.includes("info@washloop.it") && t.length < 320)
  );
}

export async function rispondi(p: {
  domanda: string;
  canale: Canale;
  /** I turni precedenti, dal più vecchio. Senza, ogni domanda è la prima: chi
   *  scrive «e per il solo stiro?» dopo una risposta sui prezzi non viene
   *  capito. Si tagliano agli ultimi turni per non far crescere il conto. */
  storico?: Turno[];
}): Promise<EsitoAssistente> {
  const chiave = process.env.ANTHROPIC_API_KEY?.trim();
  if (!chiave) {
    return { ok: false, errore: "Assistente non configurato. Scrivici a info@washloop.it e ti rispondiamo noi.", stato: 503 };
  }

  const messaggi = [
    ...(p.storico ?? []).slice(-6).map((t) => ({
      role: t.ruolo === "utente" ? ("user" as const) : ("assistant" as const),
      content: t.testo,
    })),
    { role: "user" as const, content: p.domanda },
  ];

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
        max_tokens: MAX_TOKEN_RISPOSTA,
        system: `${ISTRUZIONI}${PER_CANALE[p.canale]}\n\n---\n${await contestoDinamico()}`,
        messages: messaggi,
      }),
    });

    if (!res.ok) {
      console.error("[assistente] Anthropic ha risposto", res.status, (await res.text()).slice(0, 300));
      return { ok: false, errore: "L'assistente non risponde in questo momento. Scrivici a info@washloop.it.", stato: 502 };
    }

    const dati = (await res.json()) as { content?: { type: string; text?: string }[] };
    const risposta = (dati.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();

    const testo = risposta || "Non ho una risposta certa: scrivici a info@washloop.it.";
    return { ok: true, risposta: testo, nonLoSo: sembraNonLoSo(testo) };
  } catch (err) {
    console.error("[assistente] errore:", err);
    return { ok: false, errore: "Qualcosa è andato storto. Scrivici a info@washloop.it.", stato: 500 };
  }
}

/** Tiene traccia di cosa chiede la gente.
 *
 *  Serve a una cosa sola e concreta: sapere quali domande l'assistente non sa
 *  ancora. Senza, l'unico modo di scoprire un buco nelle FAQ è che qualcuno si
 *  lamenti — cioè quando è già andata male.
 *
 *  Non salva niente che identifichi chi ha scritto: né IP, né sessione, né
 *  numero. Best-effort: se la scrittura fallisce, la risposta parte lo stesso. */
export async function registraDomanda(p: {
  canale: Canale;
  domanda: string;
  risposta: string | null;
  nonLoSo: boolean;
}): Promise<void> {
  try {
    await createServiceClient().from("domande_assistente").insert({
      canale: p.canale,
      domanda: p.domanda.slice(0, 500),
      risposta: p.risposta?.slice(0, 2000) ?? null,
      non_lo_so: p.nonLoSo,
    });
  } catch {
    /* una domanda non registrata non vale una risposta non data */
  }
}
