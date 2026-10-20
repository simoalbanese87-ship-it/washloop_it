"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

/** Togliere un cliente dal conto di Competenza, e rimettercelo.
 *
 *  Serve perché nessuna regola prende tutti i casi. Quella di oggi ha fatto
 *  comparire i ricavi di un abbonamento manuale mai incassato — causa chiusa
 *  dove stava — ma il prossimo caso sarà un altro: un cliente da stralciare,
 *  un accordo saltato, una cifra che per quel mese non va contata. Senza
 *  questo, ogni volta bisognerebbe toccare il codice e aspettare un rilascio.
 *
 *  Il motivo è obbligatorio: un cliente che sparisce da un conto senza una
 *  ragione scritta, sei mesi dopo, è un numero che non si sa più difendere. E
 *  l'escluso resta a vista in fondo alla pagina — tolto e scritto, non tolto e
 *  basta. */

const BACK = "/admin/competenza";

function tornaA(formData: FormData): string {
  const back = String(formData.get("back") ?? "").trim();
  return /^\/admin\/competenza(\?[A-Za-z0-9_=&%.-]*)?$/.test(back) ? back : BACK;
}
const con = (dove: string, chiave: "ok" | "warn", testo: string) =>
  `${dove}${dove.includes("?") ? "&" : "?"}${chiave}=${encodeURIComponent(testo)}`;

export async function escludiDaCompetenza(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const clienteId = String(formData.get("cliente_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 300);
  const dove = tornaA(formData);
  if (!clienteId) redirect(con(dove, "warn", "Cliente mancante."));
  if (motivo.length < 3) {
    redirect(con(dove, "warn", "Scrivi perché lo togli: fra sei mesi è l'unica cosa che spiegherà quel numero."));
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({
      competenza_escluso_at: new Date().toISOString(),
      competenza_escluso_motivo: motivo,
      competenza_escluso_da: me.id,
    })
    .eq("id", clienteId);
  if (error) redirect(con(dove, "warn", error.message));

  revalidatePath(BACK);
  redirect(con(dove, "ok", "Tolto dal conto. Lo trovi in fondo alla pagina, con il motivo."));
}

export async function rimettiInCompetenza(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const clienteId = String(formData.get("cliente_id") ?? "");
  const dove = tornaA(formData);
  if (!clienteId) redirect(con(dove, "warn", "Cliente mancante."));

  const svc = createServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({ competenza_escluso_at: null, competenza_escluso_motivo: null, competenza_escluso_da: null })
    .eq("id", clienteId);
  if (error) redirect(con(dove, "warn", error.message));

  revalidatePath(BACK);
  redirect(con(dove, "ok", "Rimesso nel conto."));
}
