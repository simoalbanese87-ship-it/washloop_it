import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/** Disiscrizione dalle email non di servizio.
 *
 *  Il token identifica una riga di `leads`, così nell'URL non compare mai
 *  l'indirizzo email: un link inoltrato o finito in un log non rivela chi è.
 *
 *  Scrive in due posti di proposito: `leads.unsubscribed_at` per avere lo stato
 *  sotto gli occhi in `/admin/contatti`, e `email_optouts` come lista
 *  globale che l'invio consulta sempre. La seconda sopravvive alla
 *  cancellazione del lead — se cancelliamo la riga e la persona si riscrive
 *  domani, la sua volontà di non ricevere email resta registrata. */
export async function disiscriviConToken(token: string): Promise<{ ok: boolean; email?: string; errore?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return { ok: false, errore: "Link non valido." };
  }

  const svc = createServiceClient();
  const { data: lead } = await svc
    .from("leads")
    .select("id, email, unsubscribed_at")
    .eq("unsub_token", token)
    .maybeSingle<{ id: string; email: string; unsubscribed_at: string | null }>();

  if (!lead) return { ok: false, errore: "Link non valido o già scaduto." };

  const email = lead.email.trim().toLowerCase();
  const ora = new Date().toISOString();

  // Idempotente: ripetere la disiscrizione non è un errore, è la stessa volontà
  // espressa due volte. I client di posta rifanno la richiesta più di una volta.
  if (!lead.unsubscribed_at) {
    await svc.from("leads").update({ unsubscribed_at: ora }).eq("id", lead.id);
  }
  await svc.from("email_optouts").upsert({ email, source: "landing" }, { onConflict: "email" });

  return { ok: true, email };
}
