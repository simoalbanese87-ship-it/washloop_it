import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";
import { abbonamentoVivo } from "@/lib/puo-prenotare";
import type { StoriaCliente } from "@/lib/invito-recensione";

/** Chi può ricevere l'invito a recensire, e con quali numeri.
 *
 *  Sta in un modulo suo perché lo leggono in due: la pagina del pannello, che
 *  fa l'elenco, e l'azione che manda l'email, che deve scrivere **gli stessi**
 *  numeri che la pagina mostrava un attimo prima. Due conti separati sono due
 *  conti che prima o poi dicono cose diverse, e qui la differenza finisce
 *  dentro un'email a un cliente vero.
 *
 *  Si legge col service client: sono dati di tutti i clienti, e una lettura
 *  che decide non passa mai dalle regole di riga. */

export type Candidato = {
  id: string;
  nome: string | null;
  codice: string | null;
  consegne: number;
  primoRitiro: string | null;
  ultimaConsegna: string | null;
  abbonamentoVivo: boolean;
  chiestaAt: string | null;
  storia: StoriaCliente;
};

type Svc = ReturnType<typeof createServiceClient>;
type Profilo = {
  id: string;
  full_name: string | null;
  client_code: string | null;
  is_test: boolean | null;
  recensione_chiesta_at: string | null;
};
type Ordine = { customer_id: string | null; status: string; pickup_slot_id: string | null; delivery_slot_id: string | null };
type Abbonamento = { user_id: string; status: string; cancel_at: string | null };

const CONSEGNATI = ["delivered", "completed"];

/** Il mese scritto come lo direbbe una persona: «settembre». */
function mese(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "long" }).format(d);
}

/** Chi ha un abbonamento ancora in piedi.
 *
 *  Due campi, non uno: `cancel_at` è la data in cui finisce, e fino a quel
 *  giorno lo stato su Stripe resta `active`. Guardarne uno solo fa risultare
 *  attivo chi ha già disdetto. Chi ha due abbonamenti — uno chiuso e uno nuovo
 *  — è un cliente attivo: basta che uno dei due sia vivo. */
function conAbbonamentoVivo(abbonamenti: Abbonamento[], ora: number): Set<string> {
  const vivi = new Set<string>();
  for (const s of abbonamenti) {
    const scaduto = s.cancel_at != null && Date.parse(s.cancel_at) <= ora;
    if (abbonamentoVivo(s.status) && !scaduto) vivi.add(s.user_id);
  }
  return vivi;
}

/** Tutti quelli che hanno ricevuto almeno una riconsegna, divisi fra chi
 *  l'invito l'ha già avuto e chi no. Gli account di prova restano fuori. */
export async function candidatiRecensione(
  svc: Svc,
  ora: number = Date.now(),
): Promise<{ daInvitare: Candidato[]; invitati: Candidato[] }> {
  const [{ data: profili }, { data: ordini }, { data: abbonamenti }] = await Promise.all([
    svc.from("profiles").select("id, full_name, client_code, is_test, recensione_chiesta_at").returns<Profilo[]>(),
    svc.from("orders").select("customer_id, status, pickup_slot_id, delivery_slot_id").returns<Ordine[]>(),
    svc.from("subscriptions").select("user_id, status, cancel_at").returns<Abbonamento[]>(),
  ]);

  const consegne = new Map<string, number>();
  const fasce = new Map<string, { ritiri: string[]; consegne: string[] }>();
  for (const o of ordini ?? []) {
    if (!o.customer_id || !CONSEGNATI.includes(o.status)) continue;
    consegne.set(o.customer_id, (consegne.get(o.customer_id) ?? 0) + 1);
    const g = fasce.get(o.customer_id) ?? { ritiri: [], consegne: [] };
    if (o.pickup_slot_id) g.ritiri.push(o.pickup_slot_id);
    if (o.delivery_slot_id) g.consegne.push(o.delivery_slot_id);
    fasce.set(o.customer_id, g);
  }

  const idFasce = [...new Set([...fasce.values()].flatMap((g) => [...g.ritiri, ...g.consegne]))];
  const { data: righeFasce } = idFasce.length
    ? await svc.from("slots").select("id, starts_at").in("id", idFasce).returns<{ id: string; starts_at: string }[]>()
    : { data: [] as { id: string; starts_at: string }[] };
  const quando = new Map((righeFasce ?? []).map((f) => [f.id, f.starts_at]));
  const date = (ids: string[]) => ids.map((i) => quando.get(i)).filter((d): d is string => !!d).sort();

  const vivi = conAbbonamentoVivo(abbonamenti ?? [], ora);

  const tutti: Candidato[] = (profili ?? [])
    .filter((p) => !p.is_test && (consegne.get(p.id) ?? 0) > 0)
    .map((p) => {
      const g = fasce.get(p.id) ?? { ritiri: [], consegne: [] };
      const primoRitiro = date(g.ritiri).at(0) ?? null;
      const ultimaConsegna = date(g.consegne).at(-1) ?? null;
      const sacchi = consegne.get(p.id) ?? 0;
      return {
        id: p.id,
        nome: p.full_name,
        codice: p.client_code,
        consegne: sacchi,
        primoRitiro,
        ultimaConsegna,
        abbonamentoVivo: vivi.has(p.id),
        chiestaAt: p.recensione_chiesta_at,
        storia: { sacchi, meseDiPartenza: mese(primoRitiro) },
      };
    })
    .sort((a, b) => (b.ultimaConsegna ?? "").localeCompare(a.ultimaConsegna ?? ""));

  return {
    daInvitare: tutti.filter((c) => !c.chiestaAt),
    invitati: tutti.filter((c) => c.chiestaAt),
  };
}
