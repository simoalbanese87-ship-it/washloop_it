"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notifyStaffAccount } from "@/lib/notify";

/** Gestione accessi staff (lavanderia = partner, rider = courier, sales).
 *  L'admin crea l'account: la password è generata e inviata via email al membro,
 *  mai mostrata qui. Nessuna password viene scelta o esposta lato admin. */

const AREA: Record<string, { label: string; path: string }> = {
  partner: { label: "Area Lavanderia", path: "/laundry" },
  courier: { label: "Area Rider", path: "/courier" },
  sales: { label: "Area Sales", path: "/sales" },
};

async function requireAdmin() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  return me;
}

const REV = "/admin/team";

export async function createStaff(formData: FormData) {
  await requireAdmin();
  const role = String(formData.get("role") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const laundry_id = String(formData.get("laundry_id") ?? "") || null;
  if (!AREA[role]) throw new Error("Ruolo non valido");
  if (!email || !full_name) throw new Error("Email e nome obbligatori");
  if (role === "partner" && !laundry_id) redirect(`${REV}?warn=${encodeURIComponent("Per la lavanderia scegli quale sede assegnare.")}`);

  const svc = createServiceClient();
  const password = `WL!${crypto.randomBytes(4).toString("hex")}`;
  const { data: created, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name, phone },
  });
  if (error || !created?.user) redirect(`${REV}?warn=${encodeURIComponent(error?.message || "Creazione accesso fallita")}`);
  const uid = created!.user.id;

  await svc.from("profiles").update({
    full_name, phone, role,
    laundry_id: role === "partner" ? laundry_id : null,
  }).eq("id", uid);

  const area = AREA[role];
  await notifyStaffAccount({ to: email, fullName: full_name, password, areaLabel: area.label, areaPath: area.path });

  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent(`Accesso creato: credenziali inviate a ${email}.`)}`);
}

/** Reinvia le credenziali (nuova password temporanea) a un membro staff. */
export async function resetStaffPassword(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Membro mancante");
  const svc = createServiceClient();

  const { data: au } = await svc.auth.admin.getUserById(id);
  const email = au?.user?.email;
  if (!email) redirect(`${REV}?warn=${encodeURIComponent("Email non trovata.")}`);

  const { data: prof } = await svc.from("profiles").select("full_name, role").eq("id", id).maybeSingle<{ full_name: string | null; role: string }>();
  const area = AREA[prof?.role ?? ""] ?? { label: "Area WashLoop", path: "/login" };
  const password = `WL!${crypto.randomBytes(4).toString("hex")}`;
  const { error } = await svc.auth.admin.updateUserById(id, { password });
  if (error) redirect(`${REV}?warn=${encodeURIComponent(error.message)}`);

  await notifyStaffAccount({ to: email!, fullName: prof?.full_name ?? "Staff", password, areaLabel: area.label, areaPath: area.path });
  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent(`Nuove credenziali inviate a ${email}.`)}`);
}

/** Elimina definitivamente un membro staff (auth user → cascade). */
export async function deleteStaff(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Membro mancante");
  const svc = createServiceClient();
  const { error } = await svc.auth.admin.deleteUser(id);
  if (error) redirect(`${REV}?warn=${encodeURIComponent(error.message)}`);
  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent("Accesso eliminato.")}`);
}
