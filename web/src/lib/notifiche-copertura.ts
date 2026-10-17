import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/** Chi riceve davvero le notifiche, e chi crede di riceverle.
 *
 *  Il 17 ottobre 2026 la risposta era: tre dispositivi in tutto il sistema —
 *  due clienti e la lavanderia. Nessun rider, nessun admin. Non era un guasto
 *  del codice: l'invito ad attivarle viveva solo nell'app del cliente e nel
 *  portale della lavanderia, e chi lavora dentro `/courier` o `/admin` non se
 *  l'è mai visto comparire.
 *
 *  Sta in pagina perché è una cosa che va **guardata**, non dedotta: un avviso
 *  che non arriva non lascia traccia da nessuna parte, e il rider se ne
 *  accorge solo saltando un giro.
 *
 *  Si legge col service client: su `push_subscriptions` la policy mostra a
 *  ciascuno le sue, quindi con la sessione dell'admin il conteggio degli altri
 *  **tornerebbe zero senza errore** — cioè la risposta sbagliata, scritta come
 *  se fosse giusta. */

export type Copertura = {
  /** Totale dispositivi iscritti. */
  dispositivi: number;
  /** Chi lavora con noi: nome, ruolo e se ha almeno un dispositivo. */
  operativi: { nome: string; ruolo: string; dispositivi: number }[];
  /** I clienti con abbonamento in corso. */
  clienti: { conNotifiche: number; totale: number };
};

const RUOLO_IT: Record<string, string> = {
  courier: "Rider",
  partner: "Lavanderia",
  admin: "Ops",
  sales: "Sales",
};

export async function coperturaNotifiche(): Promise<Copertura> {
  const svc = createServiceClient();

  const [{ data: subs }, { data: profili }, { data: abbonamenti }] = await Promise.all([
    svc.from("push_subscriptions").select("user_id").returns<{ user_id: string }[]>(),
    svc
      .from("profiles")
      .select("id, full_name, role, is_test")
      .in("role", ["courier", "partner", "admin", "sales"])
      .returns<{ id: string; full_name: string | null; role: string; is_test: boolean | null }[]>(),
    svc
      .from("subscriptions")
      .select("user_id, status")
      .in("status", ["active", "trialing"])
      .returns<{ user_id: string | null; status: string }[]>(),
  ]);

  const quanti = new Map<string, number>();
  for (const s of subs ?? []) quanti.set(s.user_id, (quanti.get(s.user_id) ?? 0) + 1);

  const operativi = (profili ?? [])
    .filter((p) => !p.is_test)
    .map((p) => ({
      nome: p.full_name ?? "—",
      ruolo: RUOLO_IT[p.role] ?? p.role,
      dispositivi: quanti.get(p.id) ?? 0,
    }))
    // Prima chi non le ha: è l'elenco su cui si agisce.
    .sort((a, b) => a.dispositivi - b.dispositivi || a.ruolo.localeCompare(b.ruolo));

  const clientiAttivi = [...new Set((abbonamenti ?? []).map((a) => a.user_id).filter((u): u is string => !!u))];

  return {
    dispositivi: subs?.length ?? 0,
    operativi,
    clienti: {
      totale: clientiAttivi.length,
      conNotifiche: clientiAttivi.filter((id) => (quanti.get(id) ?? 0) > 0).length,
    },
  };
}
