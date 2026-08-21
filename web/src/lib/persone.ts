import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

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
 *  alla disdetta. */

export const STADI = ["lead", "registrato", "attivo", "difficolta", "perso"] as const;
export type Stadio = (typeof STADI)[number];

export const STADIO_LABEL: Record<Stadio, string> = {
  lead: "Lead",
  registrato: "Registrato",
  attivo: "Cliente attivo",
  difficolta: "Pagamento fallito",
  perso: "Cliente perso",
};

export const STADIO_TONO: Record<Stadio, string> = {
  lead: "bg-navy/10 text-navy/70",
  registrato: "bg-[#2b7fd4]/12 text-blue",
  attivo: "bg-[#1F8A5B]/12 text-[#1F8A5B]",
  difficolta: "bg-[#C0392B]/12 text-[#C0392B]",
  perso: "bg-[#C9881F]/12 text-[#C9881F]",
};

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

const ATTIVI = ["active", "trialing"];
const vivo = (status: string, fine: string | null) =>
  ATTIVI.includes(status) && (!fine || new Date(fine).getTime() >= Date.now());

export async function elencoPersone(includiProva = false): Promise<Persona[]> {
  const svc = createServiceClient();

  const [{ data: profili }, { data: subs }, { data: leads }, { data: ordini }] = await Promise.all([
    svc.from("profiles").select("id, full_name, phone, client_code, created_at, is_test").eq("role", "customer")
      .returns<{ id: string; full_name: string | null; phone: string | null; client_code: string | null; created_at: string; is_test: boolean }[]>(),
    svc.from("subscriptions").select("user_id, status, custom_price_cents, current_period_end, created_at, plans(name, price_month_cents)")
      .order("created_at", { ascending: false })
      .returns<{ user_id: string; status: string; custom_price_cents: number | null; current_period_end: string | null; created_at: string; plans: { name: string; price_month_cents: number } | null }[]>(),
    svc.from("leads").select("id, full_name, email, phone, created_at, source, contact_status, covered")
      .returns<{ id: string; full_name: string; email: string; phone: string | null; created_at: string; source: string | null; contact_status: string; covered: boolean }[]>(),
    svc.from("orders").select("customer_id, created_at").neq("status", "cancelled")
      .returns<{ customer_id: string | null; created_at: string }[]>(),
  ]);

  // Email dei profili: stanno in auth, non in `profiles`.
  const emailDi = new Map<string, string>();
  for (const p of profili ?? []) {
    const { data } = await svc.auth.admin.getUserById(p.id);
    if (data?.user?.email) emailDi.set(p.id, data.user.email);
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

    let stadio: Stadio = "registrato";
    if (s) {
      if (vivo(s.status, s.current_period_end)) stadio = "attivo";
      else if (s.status === "past_due" || s.status === "unpaid") stadio = "difficolta";
      else if (s.status === "incomplete" || s.status === "incomplete_expired") stadio = "registrato";
      else stadio = "perso";
    }

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
      statoContatto: null,
      ordini: ord?.n ?? 0,
      ultimoOrdine: ord?.ultimo ?? null,
      creatoIl: p.created_at,
      isTest: p.is_test,
    });
  }

  // I lead già diventati clienti non si ripetono: è il doppione che si vedeva
  // fra Contatti e Clienti.
  for (const l of leads ?? []) {
    if (emailViste.has(norm(l.email))) continue;
    if (l.phone && normTel(l.phone) && telViste.has(normTel(l.phone))) continue;
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
