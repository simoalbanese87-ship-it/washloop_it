import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { stadioDaSubscription, type Stadio } from "./persone-stadio";

/** Tutte le persone in una lista sola, ognuna con il suo stadio.
 *
 *  Prima erano due anagrafiche separate: `leads` (chi ha lasciato un contatto)
 *  e `profiles` (chi si è registrato). La stessa persona compariva in due
 *  elenchi, e in «Clienti» finivano anche i registrati che non avevano mai
 *  pagato, etichettati "Pending (lead)" — da lì l'impressione che il pannello
 *  non fosse un CRM: non lo era, erano due liste che si sovrapponevano.
 *
 *  Qui si uniscono per email (e in seconda battuta per telefono), e ognuno
 *  riceve uno stadio esplicito: dove si trova nel percorso, dal primo contatto
 *  alla disdetta.
 *
 *  Gli stadi sono quattro e non cinque: "Registrato" è stato fuso dentro
 *  "Lead". Nessuno sapeva dire che cosa fosse un registrato — chi ha aperto un
 *  account e non ha mai pagato è un contatto caldo, non una categoria a parte,
 *  e va richiamato con le stesse azioni di un lead. Quello che serviva davvero
 *  saperlo (ha già un account? gli posso rimandare le credenziali?) si legge da
 *  `profileId` e dal codice cliente, non da un'etichetta. */

// Vocabolario e regola stanno in `persone-stadio.ts`, che non importa
// `server-only` e si può quindi collaudare senza database. Riesportati qui
// perché è da questo modulo che li prende il resto dell'app.
export { STADI, STADIO_LABEL, STADIO_TONO, type Stadio } from "./persone-stadio";

export type Persona = {
  /** id del profilo se registrato, altrimenti id del lead. */
  id: string;
  profileId: string | null;
  leadId: string | null;
  nome: string;
  email: string | null;
  telefono: string | null;
  clientCode: string | null;
  stadio: Stadio;
  /** Quanto vale al mese, se abbonato. */
  valoreMensileCents: number;
  piano: string | null;
  rinnovo: string | null;
  provenienza: string | null;
  statoContatto: string | null;
  ordini: number;
  ultimoOrdine: string | null;
  creatoIl: string;
  isTest: boolean;
};

const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
/** Telefono ridotto alle ultime 10 cifre: confronta numeri scritti in modi diversi. */
const normTel = (p: string | null | undefined) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
};

export async function elencoPersone(includiProva = false): Promise<Persona[]> {
  const svc = createServiceClient();

  const [{ data: profili }, { data: subs }, { data: leads }, { data: ordini }] = await Promise.all([
    svc.from("profiles").select("id, full_name, phone, client_code, created_at, is_test, contact_status").eq("role", "customer")
      .returns<{ id: string; full_name: string | null; phone: string | null; client_code: string | null; created_at: string; is_test: boolean; contact_status: string | null }[]>(),
    svc.from("subscriptions").select("user_id, status, custom_price_cents, current_period_end, created_at, plans(name, price_month_cents)")
      .order("created_at", { ascending: false })
      .returns<{ user_id: string; status: string; custom_price_cents: number | null; current_period_end: string | null; created_at: string; plans: { name: string; price_month_cents: number } | null }[]>(),
    svc.from("leads").select("id, full_name, email, phone, created_at, source, contact_status, covered")
      .returns<{ id: string; full_name: string; email: string; phone: string | null; created_at: string; source: string | null; contact_status: string; covered: boolean }[]>(),
    svc.from("orders").select("customer_id, created_at").neq("status", "cancelled")
      .returns<{ customer_id: string | null; created_at: string }[]>(),
  ]);

  // Email dei profili: stanno in auth, non in `profiles`. Una sola chiamata
  // paginata invece di una per persona — con otto clienti erano otto richieste
  // in fila a ogni apertura della pagina, e sarebbero diventate cento con cento
  // clienti. Stesso approccio già usato in admin-metrics.
  const emailDi = new Map<string, string>();
  for (let pagina = 1; ; pagina++) {
    const { data } = await svc.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    const utenti = data?.users ?? [];
    for (const u of utenti) if (u.email) emailDi.set(u.id, u.email);
    if (utenti.length < 1000) break;
  }

  // Ultima subscription per utente: un cliente può averne più d'una.
  const ultimaSub = new Map<string, NonNullable<typeof subs>[number]>();
  for (const s of subs ?? []) if (!ultimaSub.has(s.user_id)) ultimaSub.set(s.user_id, s);

  const conteggioOrdini = new Map<string, { n: number; ultimo: string }>();
  for (const o of ordini ?? []) {
    if (!o.customer_id) continue;
    const c = conteggioOrdini.get(o.customer_id);
    if (!c) conteggioOrdini.set(o.customer_id, { n: 1, ultimo: o.created_at });
    else conteggioOrdini.set(o.customer_id, { n: c.n + 1, ultimo: o.created_at > c.ultimo ? o.created_at : c.ultimo });
  }

  const persone: Persona[] = [];
  const emailViste = new Set<string>();
  const telViste = new Set<string>();

  for (const p of profili ?? []) {
    if (!includiProva && p.is_test) continue;
    const s = ultimaSub.get(p.id);
    const email = emailDi.get(p.id) ?? null;
    const ord = conteggioOrdini.get(p.id);

    const stadio: Stadio = stadioDaSubscription(s);

    if (email) emailViste.add(norm(email));
    if (p.phone) telViste.add(normTel(p.phone));

    persone.push({
      id: p.id,
      profileId: p.id,
      leadId: null,
      nome: p.full_name ?? "—",
      email,
      telefono: p.phone,
      clientCode: p.client_code,
      stadio,
      valoreMensileCents: stadio === "attivo" ? s?.custom_price_cents ?? s?.plans?.price_month_cents ?? 0 : 0,
      piano: s?.plans?.name ?? null,
      rinnovo: s?.current_period_end ?? null,
      provenienza: null,
      statoContatto: p.contact_status,
      ordini: ord?.n ?? 0,
      ultimoOrdine: ord?.ultimo ?? null,
      creatoIl: p.created_at,
      isTest: p.is_test,
    });
  }

  // Chi ha un account non è più un lead, qualunque ruolo abbia. Il confronto
  // usa TUTTE le email registrate e non solo quelle dei clienti visibili:
  // altrimenti un lead con l'email di un account nascosto (di prova, o dello
  // staff) ricomparirebbe nella lista come se non si fosse mai registrato.
  const emailRegistrate = new Set([...emailDi.values()].map(norm));

  for (const l of leads ?? []) {
    if (emailViste.has(norm(l.email)) || emailRegistrate.has(norm(l.email))) continue;
    if (l.phone && normTel(l.phone) && telViste.has(normTel(l.phone))) continue;
    // Anche fra loro: la stessa persona può aver compilato il modulo due volte
    // con due email diverse ma lo stesso numero, e in lista comparivano due
    // righe come se fossero due contatti distinti.
    emailViste.add(norm(l.email));
    if (l.phone && normTel(l.phone)) telViste.add(normTel(l.phone));
    persone.push({
      id: l.id,
      profileId: null,
      leadId: l.id,
      nome: l.full_name,
      email: l.email,
      telefono: l.phone,
      clientCode: null,
      stadio: "lead",
      valoreMensileCents: 0,
      piano: null,
      rinnovo: null,
      provenienza: l.source ?? "landing",
      statoContatto: l.contact_status,
      ordini: 0,
      ultimoOrdine: null,
      creatoIl: l.created_at,
      isTest: false,
    });
  }

  persone.sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1));
  return persone;
}

/** Chi è davvero da richiamare: un lead, con lo stato del contatto ancora
 *  aperto. Stato non impostato conta come "da contattare", perché è così che lo
 *  mostra la lista.
 *
 *  Passa dalla stessa deduplica dell'elenco e non da una query sui soli `leads`:
 *  la dashboard contava cinque persone da contattare, e due erano già clienti —
 *  uno di loro un abbonato attivo e pagante. Chiedeva di rincorrere gente che
 *  avevamo già. */
export async function daContattare(includiProva = false): Promise<Persona[]> {
  const tutte = await elencoPersone(includiProva);
  return tutte.filter((p) => p.stadio === "lead" && (p.statoContatto == null || p.statoContatto === "da_contattare"));
}
