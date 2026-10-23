"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notifyStaffAccount } from "@/lib/notify";
import { perchéNoCambioRuolo, RUOLO_LABEL, type Ruolo } from "@/lib/ruoli";

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

/** Cambia il ruolo di un account che esiste già, senza toccare email e
 *  password: l'accesso resta il suo, cambia solo cosa vede entrando.
 *
 *  Perché serviva
 *  --------------
 *  Finora il ruolo si poteva assegnare solo alla nascita, creando un accesso
 *  nuovo. Per promuovere una persona che aveva già un account non c'era nessuna
 *  strada dal pannello: restava scriverlo nel database, aggirando il trigger
 *  che protegge quella colonna. Una strada che passa per il database è una
 *  strada che prima o poi qualcuno percorre di fretta.
 *
 *  Le due guardie stanno in `ruoli.ts` con i loro test: non ci si cambia il
 *  ruolo da soli, e l'ultimo amministratore non si declassa. La scrittura passa
 *  dalla service key, che il trigger della 0049 riconosce come backend fidato.
 *
 *  Si rilegge il profilo dopo la scrittura invece di fidarsi dell'assenza di
 *  errore: quella colonna ha un trigger sopra, e un `update` che non tocca
 *  nessuna riga per il database non è un errore. */
export async function cambiaRuolo(formData: FormData) {
  const me = await requireAdmin();
  // Si identifica per email e non per id: l'email è la cosa che un
  // amministratore ha davvero sottomano, l'id non lo conosce nessuno.
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ruoloNuovo = String(formData.get("role") ?? "");
  const laundryId = String(formData.get("laundry_id") ?? "") || null;
  if (!email) redirect(`${REV}?warn=${encodeURIComponent("Scrivi l'email dell'account.")}`);

  const svc = createServiceClient();
  const { data: elenco } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const utente = (elenco?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
  if (!utente) redirect(`${REV}?warn=${encodeURIComponent(`Nessun account con l'email ${email}.`)}`);
  const userId = utente!.id;

  const [{ data: prof }, { count: quantiAdmin }] = await Promise.all([
    svc.from("profiles").select("id, full_name, role").eq("id", userId).maybeSingle<{ id: string; full_name: string | null; role: string }>(),
    svc.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
  ]);
  if (!prof) redirect(`${REV}?warn=${encodeURIComponent("Account senza profilo: non si può cambiare il ruolo.")}`);

  const no = perchéNoCambioRuolo({
    ioId: me.id,
    utenteId: prof!.id,
    ruoloAttuale: prof!.role,
    ruoloNuovo,
    quantiAdmin: quantiAdmin ?? 0,
  });
  if (no) redirect(`${REV}?warn=${encodeURIComponent(no)}`);

  // La sede serve solo alla lavanderia, e su ogni altro ruolo va tolta: un
  // rider con una sede attaccata non vuol dire niente, e su un amministratore
  // restringerebbe quello che vede senza che nessuno l'abbia chiesto.
  if (ruoloNuovo === "partner" && !laundryId) {
    redirect(`${REV}?warn=${encodeURIComponent("Per la lavanderia scegli quale sede assegnare.")}`);
  }
  const { error } = await svc
    .from("profiles")
    .update({ role: ruoloNuovo, laundry_id: ruoloNuovo === "partner" ? laundryId : null })
    .eq("id", userId);

  const { data: verifica } = await svc.from("profiles").select("role").eq("id", userId).maybeSingle<{ role: string }>();
  if (error || verifica?.role !== ruoloNuovo) {
    redirect(`${REV}?warn=${encodeURIComponent(`Ruolo non cambiato${error ? `: ${error.message}` : "."}`)}`);
  }

  revalidatePath(REV);
  revalidatePath("/admin/persone");
  revalidatePath("/admin/sicurezza");
  redirect(
    `${REV}?ok=${encodeURIComponent(
      `${prof!.full_name ?? "L'account"} adesso è ${RUOLO_LABEL[ruoloNuovo as Ruolo]}. Email e password non sono state toccate.`,
    )}`,
  );
}
