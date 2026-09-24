import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/** Ponte verso Fatture in Cloud (API v2).
 *
 *  Cosa fa questo file: manda i dati. Cosa NON fa: emettere documenti fiscali.
 *  Numerazione progressiva, XML, trasmissione allo SdI, notifiche di scarto e
 *  conservazione a norma restano tutte dentro FIC — se domani staccassimo
 *  questo collegamento, le fatture resterebbero comunque nel loro account.
 *
 *  Il ponte è INERTE finché `FIC_MODE` non viene impostata. Tre stati:
 *    off    (default) — non fa niente, si limita a registrare l'incasso;
 *    bozza  — crea il documento su FIC ma NON lo manda allo SdI;
 *    invia  — crea e trasmette.
 *  Il default è "off" di proposito: il regime fiscale (fattura a ogni cliente
 *  o corrispettivi) è una decisione del commercialista, e finché non c'è
 *  emettere documenti veri sarebbe peggio che non emetterne. */

const API = "https://api-v2.fattureincloud.it";
const OAUTH = "https://api-v2.fattureincloud.it/oauth/token";

export type FicMode = "off" | "bozza" | "invia";
export const ficMode = (): FicMode => {
  const v = (process.env.FIC_MODE ?? "off").trim().toLowerCase();
  return v === "bozza" || v === "invia" ? v : "off";
};

type Riga = { access_token: string; refresh_token: string; expires_at: string; company_id: number | null };

/** Token valido, rinnovandolo se sta per scadere.
 *
 *  Il refresh token RUOTA a ogni rinnovo: per questo i token stanno in tabella e
 *  non in una variabile d'ambiente, che a runtime non è scrivibile. Il nuovo lo
 *  riscriviamo subito, prima di usarlo. */
async function accessToken(): Promise<{ token: string; companyId: number } | null> {
  const clientId = process.env.FIC_CLIENT_ID?.trim();
  const clientSecret = process.env.FIC_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const svc = createServiceClient();
  const { data: riga } = await svc.from("fic_tokens").select("access_token, refresh_token, expires_at, company_id").eq("id", 1).maybeSingle<Riga>();
  if (!riga) return null;

  const companyId = riga.company_id ?? parseInt(process.env.FIC_COMPANY_ID ?? "0", 10);
  if (!companyId) return null;

  // Margine di 2 minuti: un token che scade mentre la richiesta è in volo
  // fallirebbe in un punto in cui l'incasso è già avvenuto.
  const scaduto = new Date(riga.expires_at).getTime() - Date.now() < 120_000;
  if (!scaduto) return { token: riga.access_token, companyId };

  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: riga.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    console.error("[fic] rinnovo token fallito:", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const j = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  await svc.from("fic_tokens").update({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  return { token: j.access_token, companyId };
}

async function ficFetch(path: string, init: RequestInit & { companyId?: number } = {}) {
  const auth = await accessToken();
  if (!auth) throw new Error("Fatture in Cloud non collegato (token o credenziali mancanti)");
  const url = `${API}/c/${init.companyId ?? auth.companyId}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const testo = await res.text();
  if (!res.ok) throw new Error(`FIC ${res.status} su ${path}: ${testo.slice(0, 400)}`);
  return testo ? JSON.parse(testo) : {};
}

export type DatiFattura = {
  /** Anagrafica del cliente come deve comparire sul documento. */
  cliente: {
    nome: string;
    email?: string;
    indirizzo?: string;
    cap?: string;
    citta?: string;
    /** Obbligatori per la fattura elettronica; quali servano dipende dal regime scelto. */
    codiceFiscale?: string;
    partitaIva?: string;
    codiceDestinatario?: string;
    pec?: string;
  };
  descrizione: string;
  /** Imponibile in centesimi: l'IVA la calcola FIC dall'aliquota. */
  imponibileCents: number;
  aliquotaIva: number;
  /** Data del documento, ISO breve (YYYY-MM-DD). */
  data: string;
};

export type EsitoFattura = { ok: true; id: number; numero: string | null; url: string | null; eiStatus: string | null } | { ok: false; errore: string };

/** Crea il documento su Fatture in Cloud e, in modalità "invia", lo trasmette allo SdI. */
export async function creaFattura(d: DatiFattura): Promise<EsitoFattura> {
  const mode = ficMode();
  if (mode === "off") return { ok: false, errore: "FIC_MODE=off: ponte non attivo" };

  try {
    const corpo = {
      data: {
        type: "invoice",
        entity: {
          name: d.cliente.nome,
          email: d.cliente.email,
          address_street: d.cliente.indirizzo,
          address_postal_code: d.cliente.cap,
          address_city: d.cliente.citta,
          country: "Italia",
          tax_code: d.cliente.codiceFiscale,
          vat_number: d.cliente.partitaIva,
          e_invoice: true,
          ei_code: d.cliente.codiceDestinatario || "0000000",
          certified_email: d.cliente.pec,
        },
        date: d.data,
        // È FIC a numerare: la numerazione progressiva deve restare una sola,
        // e deve stare dove ci sono già le altre fatture dell'azienda.
        e_invoice: true,
        items_list: [
          {
            name: d.descrizione,
            net_price: d.imponibileCents / 100,
            qty: 1,
            vat: { id: 0, value: d.aliquotaIva },
          },
        ],
      },
    };

    const creato = await ficFetch("/issued_documents", { method: "POST", body: JSON.stringify(corpo) });
    const doc = creato?.data ?? {};
    const id: number | undefined = doc.id;
    if (!id) return { ok: false, errore: "FIC non ha restituito l'id del documento" };

    let eiStatus: string | null = doc.ei_status ?? null;
    if (mode === "invia") {
      // L'invio allo SdI via API è disponibile solo sui piani a pagamento di
      // FIC: se il piano non lo consente qui arriva un errore, e il documento
      // resta comunque creato — si trasmette a mano dal loro pannello.
      const inviato = await ficFetch(`/issued_documents/${id}/e_invoice/send`, { method: "POST", body: JSON.stringify({}) });
      eiStatus = inviato?.data?.ei_status ?? eiStatus;
    }

    return { ok: true, id, numero: doc.number ? String(doc.number) : null, url: doc.url ?? null, eiStatus };
  } catch (err) {
    return { ok: false, errore: err instanceof Error ? err.message : "errore sconosciuto" };
  }
}

/** Rilegge da FIC lo stato di trasmissione di un documento già creato. */
export async function statoFattura(documentId: number): Promise<string | null> {
  try {
    const r = await ficFetch(`/issued_documents/${documentId}?fields=ei_status`);
    return r?.data?.ei_status ?? null;
  } catch (err) {
    console.error(`[fic] lettura stato documento ${documentId} fallita:`, err);
    return null;
  }
}
