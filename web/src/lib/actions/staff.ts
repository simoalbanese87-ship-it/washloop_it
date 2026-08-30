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

  // Il ruolo è la cosa che rende questo account un accesso staff, e finché non
  // è scritto l'account non è nato: restava `customer`, spariva dall'elenco e
  // il pannello annunciava lo stesso "Accesso creato", con tanto di password
  // spedita a una persona che non poteva entrare da nessuna parte.
  //
  // Si rilegge il profilo invece di fidarsi dell'assenza di errore: la scrittura
  // passa da un trigger, e un `update` che non tocca nessuna riga non è un
  // errore per il database.
  const { error: erroreProfilo } = await svc
    .from("profiles")
    .update({
      full_name,
      phone,
      role,
      laundry_id: role === "partner" ? laundry_id : null,
    })
    .eq("id", uid);

  const { data: verifica } = await svc
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle<{ role: string }>();

  if (erroreProfilo || verifica?.role !== role) {
    // Niente account a metà in giro: si annulla la creazione e si dice perché.
    await svc.auth.admin.deleteUser(uid);
    const motivo = erroreProfilo?.message ?? "il ruolo non è stato assegnato";
    redirect(`${REV}?warn=${encodeURIComponent(`Accesso NON creato (${motivo}). Nessuna email inviata: riprova.`)}`);
  }

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

/** Cambia l'indirizzo con cui un membro staff accede, lasciando intatta la password.
 *
 *  Serve al passaggio dai dati di prova a quelli veri: gli account rider e
 *  lavanderia nascono come `*.test@washloop.it` e vanno intestati alle persone
 *  reali senza costringerle a rifare l'accesso da zero.
 *
 *  `email_confirm: true` è la parte che conta: senza, Supabase manda un link di
 *  conferma al nuovo indirizzo e finché non viene cliccato l'accesso resta a
 *  metà. Qui l'indirizzo lo stiamo cambiando noi da pannello, su nostra
 *  decisione, quindi lo diamo per verificato.
 *
 *  Nessun disallineamento da sistemare: `profiles` non contiene l'email,
 *  l'unica copia sta in `auth.users`. */
export async function updateStaffEmail(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!id) throw new Error("Membro mancante");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect(`${REV}?warn=${encodeURIComponent("Indirizzo email non valido.")}`);
  }

  const svc = createServiceClient();
  const { data: prima } = await svc.auth.admin.getUserById(id);
  const vecchia = prima?.user?.email ?? "—";

  const { error } = await svc.auth.admin.updateUserById(id, { email, email_confirm: true });
  if (error) redirect(`${REV}?warn=${encodeURIComponent(error.message)}`);

  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent(`Accesso spostato da ${vecchia} a ${email}. La password non è cambiata.`)}`);
}

/** Elimina definitivamente un membro staff (auth user → cascade). */
export async function deleteStaff(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Membro mancante");
  const svc = createServiceClient();

  // Quanti passaggi restano senza rider: va detto, perché vanno riassegnati e
  // nessun'altra schermata lo segnala.
  const { count } = await svc
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("courier_id", id)
    .not("status", "in", "(delivered,completed,cancelled)");

  const { error } = await svc.auth.admin.deleteUser(id);
  if (error) redirect(`${REV}?warn=${encodeURIComponent(`Accesso non eliminato: ${error.message}`)}`);

  revalidatePath(REV);
  revalidatePath("/admin/ordini");
  const scoperti = count ?? 0;
  redirect(
    `${REV}?ok=${encodeURIComponent(
      scoperti > 0
        ? `Accesso eliminato. ${scoperti} ${scoperti === 1 ? "passaggio è rimasto" : "passaggi sono rimasti"} senza rider: riassegnali dal board.`
        : "Accesso eliminato.",
    )}`,
  );
}
