"use server";

import crypto from "crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { zoneIdForCap } from "@/lib/zones";
import { appendLeadToSheet } from "@/lib/leads-sheet";
import { sendLeadConfirmation } from "@/lib/lead-email";
import { getCurrentProfile } from "@/lib/auth";
import { notifyNewCustomer } from "@/lib/notify";
import { CONTACT_STATUS_LABEL, isContactStatus, type ContactStatus } from "@/lib/lead-status";

/** Invio del form della landing "/disponibilita" — pubblico e non autenticato.
 *  Fonte di verità: la tabella `leads` su Supabase. Copia sul Google Sheet e mail
 *  di conferma sono best-effort: se falliscono, il lead resta salvo e l'utente
 *  arriva comunque alla pagina di ringraziamento.
 *  La scrittura passa dal service client: la tabella non ha policy di INSERT per
 *  anon, così nessuno può inserire righe scavalcando questa validazione. */

export type LeadFormState = { error: string | null };

const PLANS = new Set(["S", "M", "L"]);
const PLAN_LABEL: Record<string, string> = { S: "Piano S", M: "Piano M", L: "Piano L" };

/** Max richieste accettate nell'ultima ora dallo stesso IP. */
const MAX_PER_HOUR = 3;

/** Hash dell'IP con segreto server-side: in tabella non finisce mai l'IP in
 *  chiaro (minimizzazione GDPR), ma resta confrontabile per il rate limit. */
async function hashIp(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  if (!ip) return null;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "washloop";
  return crypto.createHmac("sha256", secret).update(ip).digest("hex");
}

export async function submitLead(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  // Honeypot: campo invisibile agli umani. Se è pieno è un bot → usciamo
  // fingendo successo, così non impara a evitarlo.
  if (String(formData.get("azienda") ?? "").trim() !== "") redirect("/disponibilita/grazie?c=1");

  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim().replace(/\s+/g, " ");
  const cap = String(formData.get("cap") ?? "").trim();
  const plan = String(formData.get("plan") ?? "").trim().toUpperCase();
  const consent = formData.get("privacy") != null;

  if (fullName.length < 2) return { error: "Inserisci nome e cognome." };
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return { error: "Inserisci un indirizzo email valido." };
  // Volutamente permissiva: accetta prefisso internazionale, spazi, punti e
  // trattini. Conta solo che ci siano abbastanza cifre per richiamare.
  if (!/^\+?[\d\s.\-()]{8,20}$/.test(phone) || (phone.match(/\d/g) ?? []).length < 8) {
    return { error: "Inserisci un numero di telefono valido." };
  }
  if (!/^\d{5}$/.test(cap)) return { error: "Il CAP deve essere di 5 cifre." };
  if (!PLANS.has(plan)) return { error: "Scegli un piano." };
  if (!consent) return { error: "Serve il consenso al trattamento dei dati per procedere." };

  const svc = createServiceClient();

  // Rate limit per IP: il conteggio sta in tabella, quindi regge anche con più
  // istanze serverless (una Map in memoria no).
  const ipHash = await hashIp();
  if (ipHash) {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await svc
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_HOUR) {
      return { error: "Abbiamo già ricevuto la tua richiesta. Riprova più tardi." };
    }
  }

  // Copertura reale: il CAP è mappato a una zona attiva in `zone_caps`?
  const zoneId = await zoneIdForCap(svc, cap);
  const covered = zoneId !== null;

  // Nome del quadrante, solo per la riga sul foglio (in DB basta lo zone_id).
  let zoneName = "";
  if (zoneId) {
    const { data: z } = await svc.from("zones").select("name").eq("id", zoneId).maybeSingle<{ name: string }>();
    zoneName = z?.name ?? "";
  }

  const utmSource = String(formData.get("utm_source") ?? "").trim();
  const utmMedium = String(formData.get("utm_medium") ?? "").trim();
  const utmCampaign = String(formData.get("utm_campaign") ?? "").trim();
  const utm = utmSource || utmMedium || utmCampaign
    ? { source: utmSource || null, medium: utmMedium || null, campaign: utmCampaign || null }
    : null;

  const now = new Date().toISOString();

  // Reinvio dallo stesso indirizzo: aggiorniamo la riga ma NON rimandiamo la
  // mail di conferma se ne ha già ricevuta una nelle ultime 24 ore.
  const { data: existing } = await svc
    .from("leads")
    .select("consent_at")
    .eq("email", email)
    .maybeSingle<{ consent_at: string }>();
  const alreadyConfirmed =
    existing != null && Date.now() - Date.parse(existing.consent_at) < 24 * 3600_000;

  // Doppio invio dalla stessa email → aggiorna la riga (indice unico su email).
  const { error } = await svc
    .from("leads")
    .upsert(
      {
        full_name: fullName,
        email,
        phone,
        cap,
        plan,
        zone_id: zoneId,
        covered,
        source: "landing",
        utm,
        consent_at: now,
        ip_hash: ipHash,
      },
      { onConflict: "email" },
    );

  if (error) {
    console.error("[leads] salvataggio fallito:", error.message);
    return { error: "Non siamo riusciti a salvare la richiesta. Riprova tra un attimo." };
  }

  // Da qui in poi il lead è al sicuro. Copia sul foglio e mail girano DOPO la
  // risposta (`after`): l'utente non aspetta Google/SMTP e un loro errore non
  // può più far fallire l'invio.
  after(async () => {
    const jobs: Promise<unknown>[] = [
      appendLeadToSheet({ createdAt: now, fullName, email, phone, cap, plan, covered, zone: zoneName, utmSource, utmMedium, utmCampaign }),
    ];
    if (!alreadyConfirmed) {
      jobs.push(sendLeadConfirmation({ to: email, fullName, cap, covered, planLabel: PLAN_LABEL[plan] }));
    }
    await Promise.allSettled(jobs);
  });

  // Nel querystring solo il flag di copertura: nessun dato personale in URL.
  redirect(`/disponibilita/grazie?c=${covered ? 1 : 0}`);
}

// ---------------------------------------------------------------------------
// Gestione lead lato admin
// ---------------------------------------------------------------------------

/** Piano indicato dal lead (S/M/L) → `code` del piano in DB. */
const PLAN_CODE: Record<string, string> = { S: "essential", M: "plus", L: "family" };

async function requireAdmin() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  return me;
}

/** Torna alla pagina da cui è partita l'azione con un messaggio. Le azioni admin
 *  non lanciano per errori "di business": mostrerebbero la pagina di errore di
 *  Next invece del banner. Stessa convenzione del resto dell'area admin. */
function backWith(formData: FormData, params: Record<string, string>): string {
  const back = String(formData.get("back") ?? "/admin/contatti") || "/admin/contatti";
  const qs = new URLSearchParams(params).toString();
  return `${back}${back.includes("?") ? "&" : "?"}${qs}`;
}

export async function setLeadContactStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("lead_id") ?? "");
  const status = String(formData.get("contact_status") ?? "");
  if (!id || !isContactStatus(status)) {
    redirect(backWith(formData, { warn: "Stato non valido." }));
  }

  const { error } = await createServiceClient().from("leads").update({ contact_status: status }).eq("id", id);
  if (error) redirect(backWith(formData, { warn: `Stato non salvato: ${error.message}` }));

  revalidatePath("/admin/contatti");
  revalidatePath("/admin");
  redirect(backWith(formData, { ok: `Stato aggiornato: ${CONTACT_STATUS_LABEL[status as ContactStatus]}.` }));
}

/** Elimina la richiesta. Tocca solo la tabella `leads`: nessun cliente, nessun
 *  ordine, e la copia eventualmente finita sul foglio resta dov'è. */
export async function deleteLead(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("lead_id") ?? "");
  if (!id) redirect(backWith(formData, { warn: "Lead non trovato." }));

  const { error } = await createServiceClient().from("leads").delete().eq("id", id);
  if (error) redirect(backWith(formData, { warn: `Eliminazione fallita: ${error.message}` }));

  revalidatePath("/admin/contatti");
  revalidatePath("/admin");
  redirect(backWith(formData, { ok: "Richiesta eliminata." }));
}

/** Trasforma la richiesta in un cliente vero: account, profilo e abbonamento
 *  "incomplete" (l'admin lo attiva con «Segna come pagato»). Stessa procedura di
 *  `createCustomer` in admin-customer.ts, con i dati presi dal lead.
 *  Il lead resta in tabella marcato "convertito"; sparisce dall'elenco lead
 *  perché la deduplica in admin-metrics lo riconosce come cliente. */
export async function convertLeadToCustomer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("lead_id") ?? "");
  if (!id) redirect(backWith(formData, { warn: "Lead non trovato." }));

  const svc = createServiceClient();
  const { data: lead } = await svc
    .from("leads")
    .select("id, full_name, email, phone, plan")
    .eq("id", id)
    .maybeSingle<{ id: string; full_name: string; email: string; phone: string | null; plan: string | null }>();
  if (!lead) redirect(backWith(formData, { warn: "Lead non trovato." }));

  const email = lead.email.toLowerCase().trim();
  const password = `WL!${crypto.randomBytes(4).toString("hex")}`;
  const { data: created, error: authError } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: lead.full_name, phone: lead.phone },
  });
  if (authError || !created?.user) {
    // Il caso frequente è l'email già registrata: meglio dirlo che dare "errore".
    const msg = authError?.message.includes("already") ? "Esiste già un utente con questa email." : authError?.message;
    redirect(backWith(formData, { warn: `Conversione non riuscita: ${msg ?? "errore"}` }));
  }
  const uid = created!.user.id;
  await svc.from("profiles").update({ full_name: lead.full_name, phone: lead.phone }).eq("id", uid);

  // Piano preferito indicato nel form: è una preferenza, non un acquisto.
  let planId: string | null = null;
  let planName: string | null = null;
  let priceLabel: string | null = null;
  const code = lead.plan ? PLAN_CODE[lead.plan] : null;
  if (code) {
    const { data: plan } = await svc.from("plans").select("id, name, price_month_cents").eq("code", code)
      .maybeSingle<{ id: string; name: string; price_month_cents: number }>();
    if (plan) {
      planId = plan.id;
      planName = plan.name;
      priceLabel = "€" + (plan.price_month_cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  await svc.from("subscriptions").insert({
    user_id: uid,
    plan_id: planId,
    status: "incomplete",
    manual: true,
    current_period_end: null,
  });

  await svc.from("leads").update({ contact_status: "convertito" }).eq("id", id);

  // Benvenuto con le credenziali temporanee (best-effort, non blocca).
  await notifyNewCustomer({ to: email, fullName: lead.full_name, password, planName, priceLabel });

  revalidatePath("/admin/contatti");
  revalidatePath("/admin/abbonati");
  revalidatePath("/admin");
  redirect(`/admin/abbonati/${uid}?ok=${encodeURIComponent("Lead convertito in cliente. Attiva l'abbonamento quando ha pagato.")}`);
}
