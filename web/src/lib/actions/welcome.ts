"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { notifyWelcome } from "@/lib/notify";

/** Manda l'email di benvenuto a chi si è appena registrato dal sito, una volta sola.
 *
 *  La registrazione avviene nel browser (`supabase.auth.signUp`), quindi non c'è
 *  un punto server dove agganciarsi: la chiamano i due form subito dopo il
 *  signup riuscito.
 *
 *  L'unicità non è affidata al chiamante — che può essere rieseguito da un
 *  ricaricamento o da un doppio clic — ma alla riga: `welcome_sent_at` viene
 *  scritta solo se è ancora null, e l'email parte solo se quella scrittura ha
 *  restituito la riga. Chi perde la corsa non manda niente.
 *
 *  Best-effort come tutte le notifiche: non lancia mai, un problema di posta non
 *  deve rompere la registrazione appena andata a buon fine. */
export async function sendWelcomeIfNeeded(): Promise<void> {
  try {
    const me = await getCurrentProfile();
    if (!me || me.role !== "customer") return;

    const svc = createServiceClient();
    const { data: vinta } = await svc
      .from("profiles")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("id", me.id)
      .is("welcome_sent_at", null)
      .select("id, full_name")
      .maybeSingle<{ id: string; full_name: string | null }>();
    if (!vinta) return; // già inviata

    const { data: utente } = await svc.auth.admin.getUserById(me.id);
    const email = utente?.user?.email;
    if (!email) return;

    await notifyWelcome(me.id, email, vinta.full_name);
  } catch (err) {
    console.error("[welcome] invio benvenuto fallito:", err);
  }
}
