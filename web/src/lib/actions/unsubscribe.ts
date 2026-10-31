import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sincronizzaDisiscritto } from "@/lib/brevo-sync";

/** Disiscrizione dalle email non di servizio.
 *
 *  Il token identifica una riga — di `leads` o di `profiles` — così nell'URL
 *  non compare mai l'indirizzo email: un link inoltrato o finito in un log non
 *  rivela chi è.
 *
 *  Due mittenti diversi, un solo link
 *  ----------------------------------
 *  I **lead** della landing ricevono email commerciali da sempre. Ai
 *  **clienti** finora mandavamo solo servizio — ritiro prenotato, bucato
 *  pronto, ricevuta — e da quelle non ci si disiscrive: chi paga un
 *  abbonamento deve sapere quando passiamo. Dal momento in cui mandiamo a un
 *  cliente anche una comunicazione commerciale, quella deve avere la sua via
 *  d'uscita, e questa è la stessa pagina.
 *
 *  Il token si cerca prima fra i lead e poi fra i profili: sono due spazi di
 *  UUID distinti e la collisione non esiste, quindi l'ordine è solo questione
 *  di quale caso è più frequente.
 *
 *  Dove finisce la volontà
 *  -----------------------
 *  Sempre in `email_optouts`, la lista globale che l'invio consulta a ogni
 *  email di marketing: sopravvive alla cancellazione del lead o del profilo, e
 *  se la stessa persona si riscrive domani la sua volontà resta registrata.
 *  Per i lead si scrive **anche** `leads.unsubscribed_at`, perché quello stato
 *  si guarda in `/admin/contatti`. Per i clienti no: una seconda colonna che
 *  dice la stessa cosa è una colonna che un giorno dirà il contrario. */
export async function disiscriviConToken(token: string): Promise<{ ok: boolean; email?: string; errore?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return { ok: false, errore: "Link non valido." };
  }

  const svc = createServiceClient();
  const ora = new Date().toISOString();

  const { data: lead } = await svc
    .from("leads")
    .select("id, email, unsubscribed_at")
    .eq("unsub_token", token)
    .maybeSingle<{ id: string; email: string; unsubscribed_at: string | null }>();

  let email: string | null = null;
  let origine = "landing";

  if (lead) {
    email = lead.email.trim().toLowerCase();
    // Idempotente: ripetere la disiscrizione non è un errore, è la stessa
    // volontà espressa due volte. I client di posta rifanno la richiesta più
    // di una volta.
    if (!lead.unsubscribed_at) {
      await svc.from("leads").update({ unsubscribed_at: ora }).eq("id", lead.id);
    }
  } else {
    const { data: profilo } = await svc
      .from("profiles")
      .select("id")
      .eq("unsub_token", token)
      .maybeSingle<{ id: string }>();
    if (profilo) {
      // L'email del cliente sta su `auth.users`, non sul profilo.
      const { data } = await svc.auth.admin.getUserById(profilo.id);
      email = data?.user?.email?.trim().toLowerCase() ?? null;
      origine = "cliente";
    }
  }

  if (!email) return { ok: false, errore: "Link non valido o già scaduto." };

  await svc.from("email_optouts").upsert({ email, source: origine }, { onConflict: "email" });

  // La stessa volontà, anche dall'altra parte: su Brevo esce da tutte le liste
  // di invio e resta solo fra i «Disiscritti», così si sa chi sono senza
  // doverlo dedurre da un registro locale che Brevo non vede.
  await sincronizzaDisiscritto(email);

  return { ok: true, email };
}
