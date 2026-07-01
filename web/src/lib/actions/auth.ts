"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/email";
import { resetPasswordEmailHtml } from "@/lib/email-templates";
import { LEGAL } from "@/lib/legal";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://washloop.it").replace(/\/+$/, "");

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Reset password "fatto in casa": generiamo il link di recovery con l'admin API
 *  di Supabase (che NON invia email) e mandiamo NOI l'email brandizzata in italiano
 *  via la nostra pipeline SMTP (Brevo). Così mittente/design/lingua sono sotto
 *  controllo, coerenti con le altre transazionali.
 *  Anti-enumeration: rispondiamo sempre {ok:true}, senza rivelare se l'email esiste. */
export async function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  const addr = (email ?? "").trim().toLowerCase();
  if (!addr || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return { ok: false };

  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.generateLink({
    type: "recovery",
    email: addr,
    options: { redirectTo: `${SITE}/auth/callback?next=/auth/reset` },
  });

  const actionUrl = data?.properties?.action_link;
  // Utente inesistente / errore: non inviamo nulla, ma non lo riveliamo.
  if (error || !actionUrl) return { ok: true };

  let fullName: string | null = null;
  const uid = data.user?.id;
  if (uid) {
    const { data: prof } = await svc.from("profiles").select("full_name").eq("id", uid).maybeSingle<{ full_name: string | null }>();
    fullName = prof?.full_name ?? null;
  }

  const html = resetPasswordEmailHtml({
    fullName,
    actionUrl,
    siteUrl: SITE,
    legal: { company: LEGAL.company, vat: LEGAL.vat, address: LEGAL.address, email: LEGAL.email, phone: LEGAL.phone },
  });
  await sendMail({ to: addr, subject: "Reimposta la tua password WashLoop 🔑", html });

  return { ok: true };
}
