import "server-only";
import { registraGuasto } from "@/lib/incidenti";
import { appartenenzeDi, type NomeLista, type Persona } from "@/lib/brevo-liste";
import type { TipoServizio } from "@/lib/tipo-servizio";

/** Il ponte verso le liste di Brevo.
 *
 *  Regola della casa, come per il foglio dei lead e per Fatture in Cloud: se la
 *  chiave non c'è la funzione non fa niente e lo dice, senza lanciare. Una
 *  email di benvenuto non deve fallire perché Brevo è lento, e un cliente non
 *  deve restare senza abbonamento perché una lista non si è aggiornata.
 *
 *  Le liste si cercano **per nome**: gli id di Brevo non stanno nel codice.
 *  Rinominare una lista in pannello diventa così un refuso da correggere, non
 *  un guasto silenzioso che scrive nella lista sbagliata.
 *
 *  Limiti rispettati: gli endpoint `/v3/contacts/*` accettano 10 richieste al
 *  secondo. Una persona costa fino a 1 + (liste dentro) + (liste fuori)
 *  chiamate, quindi il sincronizzatore di massa va a scaglioni. */

const BASE = "https://api.brevo.com/v3";

/** La chiave del sync è separata da quella di sola lettura usata in
 *  `/admin/email`: se un giorno si revoca questa, lo stato degli invii continua
 *  a vedersi. Se non c'è, si ripiega su quella storica. */
const chiave = () => process.env.BREVO_SYNC_KEY?.trim() || process.env.BREVO_API_KEY?.trim() || "";

export type Esito = { ok: true } | { ok: false; errore: string };

async function chiama(
  percorso: string,
  init: { method: "GET" | "POST" | "PUT"; body?: unknown } = { method: "GET" },
): Promise<{ ok: true; dati: unknown } | { ok: false; errore: string; stato?: number }> {
  const key = chiave();
  if (!key) return { ok: false, errore: "BREVO_SYNC_KEY non configurata" };
  try {
    const res = await fetch(`${BASE}${percorso}`, {
      method: init.method,
      headers: { "api-key": key, accept: "application/json", "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    // Il corpo si legge sempre, anche sugli errori: un 400 senza motivo è
    // indistinguibile da un 401, e i due si risolvono in modi diversi.
    const testo = await res.text();
    if (!res.ok) return { ok: false, errore: `Brevo ${res.status}: ${testo.slice(0, 300)}`, stato: res.status };
    return { ok: true, dati: testo ? JSON.parse(testo) : null };
  } catch (e) {
    return { ok: false, errore: e instanceof Error ? e.message : "errore di rete" };
  }
}

// ---------------------------------------------------------------- liste ----

type ListaBrevo = { id: number; name: string };

/** Mappa nome → id, tenuta in cache di processo. Brevo non cambia gli id da
 *  solo, e rileggerla a ogni contatto sprecherebbe il budget di richieste. */
let cacheListe: Map<string, number> | null = null;

const chiaveNome = (n: string) => n.trim().toLowerCase();

export async function listeBrevo(forza = false): Promise<Map<string, number>> {
  if (cacheListe && !forza) return cacheListe;
  const mappa = new Map<string, number>();
  // 50 per pagina: oggi le liste sono sei, il margine basta e avanza.
  const r = await chiama("/contacts/lists?limit=50&offset=0");
  if (r.ok) {
    const lists = (r.dati as { lists?: ListaBrevo[] })?.lists ?? [];
    for (const l of lists) mappa.set(chiaveNome(l.name), l.id);
    cacheListe = mappa;
  } else {
    await registraGuasto("altro", "Brevo: elenco liste non leggibile", { errore: r.errore });
  }
  return mappa;
}

/** Crea la lista se non c'è. Serve solo per «Disiscritti», che nasce da qui:
 *  le altre le ha fatte Simone e non si toccano. */
export async function assicuraLista(nome: string, folderId = 1): Promise<number | null> {
  const mappa = await listeBrevo();
  const gia = mappa.get(chiaveNome(nome));
  if (gia) return gia;
  const r = await chiama("/contacts/lists", { method: "POST", body: { name: nome, folderId } });
  if (!r.ok) {
    await registraGuasto("altro", `Brevo: lista «${nome}» non creata`, { errore: r.errore });
    return null;
  }
  const id = (r.dati as { id?: number })?.id ?? null;
  if (id) mappa.set(chiaveNome(nome), id);
  return id;
}

/** Gli attributi dei contatti, creati una volta sola. Brevo **ignora in
 *  silenzio** gli attributi che non esistono: senza questo, i nomi e i CAP
 *  spediti insieme al contatto sparirebbero senza un errore. */
export async function assicuraAttributi(): Promise<void> {
  const r = await chiama("/contacts/attributes");
  if (!r.ok) return;
  const esistenti = new Set(
    ((r.dati as { attributes?: { name: string }[] })?.attributes ?? []).map((a) => a.name.toUpperCase()),
  );
  for (const nome of ["NOME", "CAP", "FONTE", "TIPO_SERVIZIO"]) {
    if (esistenti.has(nome)) continue;
    const esito = await chiama(`/contacts/attributes/normal/${nome}`, { method: "POST", body: { type: "text" } });
    if (!esito.ok) await registraGuasto("altro", `Brevo: attributo ${nome} non creato`, { errore: esito.errore });
  }
}

// -------------------------------------------------------------- contatti ----

/** Le risposte che sembrano errori e non lo sono.
 *
 *  Brevo risponde 400 con «Contact already in list and/or does not exist» anche
 *  quando lo stato è già quello che volevamo: togliere qualcuno da una lista in
 *  cui non è mai stato è un 400, e di quei 400 ce ne sono tre o quattro per
 *  persona. Alla prima esecuzione vera il cron ha dichiarato 24 falliti su 24
 *  mentre aveva fatto tutto giusto — e un registro che grida al lupo ogni notte
 *  è un registro che fra un mese nessuno guarda più. */
const innocuo = (errore: string) =>
  /already in list|already removed|does not exist|not found|not in list/i.test(errore);

export type ContattoDaSincronizzare = {
  email: string;
  nome?: string | null;
  cap?: string | null;
  fonte?: string | null;
  tipoServizio?: TipoServizio | null;
  persona: Persona;
};

export type EsitoSync = {
  ok: boolean;
  email: string;
  dentro: NomeLista[];
  fuori: NomeLista[];
  errori: string[];
};

/** Allinea un contatto: lo crea o lo aggiorna, poi lo mette dove deve stare e
 *  lo toglie da dove non deve più stare.
 *
 *  Non lancia mai. Gli errori finiscono nel registro guasti e nell'esito, così
 *  il cron può raccontarli in una riga e il chiamante tirare dritto. */
export async function sincronizzaContatto(c: ContattoDaSincronizzare): Promise<EsitoSync> {
  const email = c.email.trim().toLowerCase();
  const { dentro, fuori } = appartenenzeDi(c.persona, c.tipoServizio ?? null);
  const errori: string[] = [];
  if (!email || !email.includes("@")) return { ok: false, email, dentro: [], fuori: [], errori: ["email non valida"] };

  const mappa = await listeBrevo();
  const id = (nome: NomeLista) => mappa.get(chiaveNome(nome)) ?? null;

  const attributi: Record<string, string> = {};
  if (c.nome) attributi.NOME = c.nome.slice(0, 120);
  if (c.cap) attributi.CAP = c.cap;
  if (c.fonte) attributi.FONTE = c.fonte;
  attributi.TIPO_SERVIZIO = c.tipoServizio ?? "";

  // `updateEnabled` fa di questa chiamata una sola cosa: crea se non c'è,
  // aggiorna se c'è. Senza, su un contatto esistente risponderebbe 400.
  const creato = await chiama("/contacts", {
    method: "POST",
    body: { email, attributes: attributi, updateEnabled: true, listIds: dentro.map(id).filter((x): x is number => x != null) },
  });
  if (!creato.ok) errori.push(creato.errore);

  // Le liste si assegnano già nella chiamata sopra; questa seconda passata
  // serve ai contatti che esistevano di già, dove `listIds` in update non
  // sempre aggiunge. È idempotente: aggiungere due volte non è un errore.
  for (const nome of dentro) {
    const l = id(nome);
    if (!l) { errori.push(`lista «${nome}» non trovata`); continue; }
    const r = await chiama(`/contacts/lists/${l}/contacts/add`, { method: "POST", body: { emails: [email] } });
    if (!r.ok && !innocuo(r.errore)) errori.push(r.errore);
  }
  for (const nome of fuori) {
    const l = id(nome);
    if (!l) continue; // una lista che non esiste non ha nessuno dentro
    const r = await chiama(`/contacts/lists/${l}/contacts/remove`, { method: "POST", body: { emails: [email] } });
    if (!r.ok && !innocuo(r.errore)) errori.push(r.errore);
  }

  if (errori.length > 0) {
    await registraGuasto("altro", "Brevo: contatto non allineato", { email, errori: errori.slice(0, 3) });
  }
  return { ok: errori.length === 0, email, dentro, fuori, errori };
}

/** Versione «non mi interessa l'esito» per gli agganci dentro i flussi vivi:
 *  registrazione, pagamento, disiscrizione. Non attende errori, non li propaga. */
export async function sincronizzaContattoSilenzioso(c: ContattoDaSincronizzare): Promise<void> {
  try {
    if (!chiave()) return;
    await sincronizzaContatto(c);
  } catch (err) {
    await registraGuasto("altro", "Brevo: sync contatto fallita", {
      email: c.email,
      errore: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Il tempo di respiro fra uno scaglione e l'altro: 10 richieste al secondo è
 *  il tetto di Brevo sugli endpoint dei contatti. */
export const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
