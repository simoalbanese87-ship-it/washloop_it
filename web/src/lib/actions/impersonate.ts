"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

/** Impersonation admin → cliente ("Accedi come"). Sicurezza:
 *  - solo admin può avviare;
 *  - l'identità admin da ripristinare è in un cookie httpOnly FIRMATO (HMAC),
 *    così non è manomettibile (no privilege escalation);
 *  - ripristino verifica che l'id sia ancora un admin.
 *  Lo swap di sessione usa un magic link generato via service role + verifyOtp. */

const COOKIE = "wl_imp";
const secret = () => process.env.IMPERSONATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";
const sign = (v: string) => crypto.createHmac("sha256", secret()).update(v).digest("hex");
const pack = (adminId: string) => `${adminId}.${sign(adminId)}`;
function unpack(raw?: string): string | null {
  if (!raw) return null;
  const [id, mac] = raw.split(".");
  if (!id || !mac) return null;
  return sign(id) === mac ? id : null;
}

/** Scambia la sessione corrente con quella dell'utente `email` (magic link). */
async function loginAs(email: string) {
  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw new Error(error?.message || "Generazione link fallita");
  const supabase = await createClient();
  const { error: vErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (vErr) throw new Error(vErr.message);
}

async function rememberAdmin(adminId: string) {
  const jar = await cookies();
  jar.set(COOKIE, pack(adminId), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 4 });
}

/** True se la sessione corrente è un'impersonation in corso. */
export async function isImpersonating(): Promise<boolean> {
  const jar = await cookies();
  return unpack(jar.get(COOKIE)?.value) !== null;
}

/** Admin → entra come cliente. */
export async function impersonate(formData: FormData) {
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== "admin") throw new Error("Solo admin");
  const targetId = String(formData.get("user_id") ?? "");
  if (!targetId) throw new Error("Utente mancante");

  const svc = createServiceClient();
  const { data: tu } = await svc.auth.admin.getUserById(targetId);
  const email = tu?.user?.email;
  if (!email) throw new Error("Email cliente non trovata");

  await rememberAdmin(admin.id);
  await loginAs(email);
  redirect("/app");
}

/** Torna admin (fine impersonation). */
export async function stopImpersonate() {
  const jar = await cookies();
  const adminId = unpack(jar.get(COOKIE)?.value);
  if (!adminId) redirect("/login");

  const svc = createServiceClient();
  const { data: prof } = await svc.from("profiles").select("role").eq("id", adminId).maybeSingle<{ role: string }>();
  const { data: au } = await svc.auth.admin.getUserById(adminId);
  const email = au?.user?.email;
  jar.delete(COOKIE);
  if (!email || prof?.role !== "admin") redirect("/login");

  await loginAs(email);
  redirect("/admin");
}

/** Admin → crea un cliente DEMO già abbonato (nessun addebito Stripe) e ci entra
 *  subito per simulare l'esperienza completa. */
export async function createDemoCustomer() {
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== "admin") throw new Error("Solo admin");

  const svc = createServiceClient();
  const rand = crypto.randomBytes(3).toString("hex");
  const email = `demo.${rand}@washloop.it`;
  const password = `Demo!${rand}2026`;

  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Cliente Demo" },
  });
  if (error || !created?.user) throw new Error(error?.message || "Creazione demo fallita");
  const uid = created.user.id;

  // Profilo (trigger lo crea) → nome
  await svc.from("profiles").update({ full_name: "Cliente Demo" }).eq("id", uid);

  // Indirizzo demo (Milano)
  const { data: zone } = await svc.from("zones").select("id").eq("active", true).order("name").limit(1).maybeSingle<{ id: string }>();
  await svc.from("addresses").insert({
    user_id: uid,
    label: "Casa",
    street: "Via Demo 1, 20121 Milano",
    zone_id: zone?.id ?? null,
    access_mode: "door",
  });

  // Abbonamento attivo concesso senza Stripe (solo per simulazione)
  const { data: plan } = await svc.from("plans").select("id").eq("active", true).order("sort").limit(1).maybeSingle<{ id: string }>();
  const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await svc.from("subscriptions").insert({
    user_id: uid,
    plan_id: plan?.id ?? null,
    status: "active",
    current_period_end: periodEnd,
  });

  // Entra come demo
  await rememberAdmin(admin.id);
  await loginAs(email);
  redirect("/app");
}
