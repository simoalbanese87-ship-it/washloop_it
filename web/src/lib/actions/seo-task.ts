"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

/** I lavori del cantiere SEO: cambiarne lo stato, annotarli, aggiungerne.
 *
 *  Passa tutto da qui e non da una scrittura diretta del browser per la solita
 *  ragione: la lettura con RLS torna vuota invece che in errore, e una pagina
 *  che decide su una lista vuota decide male. */

const CATEGORIE = ["indicizzazione", "locale", "contenuti", "tecnico", "fiducia", "misura"] as const;
const PRIORITA = ["alta", "media", "bassa"] as const;
const STATI = ["da_fare", "in_corso", "fatto", "non_serve"] as const;

export type Categoria = (typeof CATEGORIE)[number];
export type Priorita = (typeof PRIORITA)[number];
export type Stato = (typeof STATI)[number];

async function soloAdmin() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  return me;
}

const torna = (msg: string, chiave: "ok" | "warn" = "ok") =>
  redirect(`/admin/seo?${chiave}=${encodeURIComponent(msg)}`);

/** Sposta un lavoro da uno stato all'altro.
 *
 *  `fatto_at` si scrive solo quando si arriva a «fatto», e si cancella se si
 *  torna indietro: è la data in cui la cosa è successa, non l'ultima volta che
 *  qualcuno ha toccato la riga. Serve a poter dire fra un mese «questo l'avevi
 *  fatto il 3 novembre, e da allora le impressioni sono salite». */
export async function cambiaStatoSeo(formData: FormData) {
  await soloAdmin();
  const id = String(formData.get("id") ?? "");
  const stato = String(formData.get("stato") ?? "") as Stato;
  if (!id || !STATI.includes(stato)) torna("Stato non valido.", "warn");

  const svc = createServiceClient();
  const { error } = await svc
    .from("seo_tasks")
    .update({ stato, fatto_at: stato === "fatto" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) torna(`Non è stato salvato: ${error.message}`, "warn");

  revalidatePath("/admin/seo");
  torna(stato === "fatto" ? "Segnato come fatto." : "Aggiornato.");
}

/** La nota è il campo che salva il lavoro dall'oblio: ci si scrive dove si è
 *  arrivati, il link della pagina pubblicata, il motivo per cui si è fermi. */
export async function annotaSeo(formData: FormData) {
  await soloAdmin();
  const id = String(formData.get("id") ?? "");
  const nota = String(formData.get("nota") ?? "").trim();
  if (!id) torna("Lavoro non trovato.", "warn");

  const svc = createServiceClient();
  const { error } = await svc.from("seo_tasks").update({ nota: nota || null }).eq("id", id);
  if (error) torna(`Non è stata salvata: ${error.message}`, "warn");

  revalidatePath("/admin/seo");
  torna("Nota salvata.");
}

/** Una voce nuova. Il titolo basta: il resto si aggiunge quando si sa. */
export async function aggiungiSeo(formData: FormData) {
  await soloAdmin();
  const titolo = String(formData.get("titolo") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "contenuti") as Categoria;
  const priorita = String(formData.get("priorita") ?? "media") as Priorita;
  const perche = String(formData.get("perche") ?? "").trim();

  if (!titolo) torna("Scrivi almeno che cosa c'è da fare.", "warn");
  if (!CATEGORIE.includes(categoria) || !PRIORITA.includes(priorita)) torna("Categoria o priorità non valida.", "warn");

  const svc = createServiceClient();
  // In fondo all'elenco della sua categoria: chi aggiunge una voce non sta
  // dicendo che viene prima di quelle già decise.
  const { data: ultimo } = await svc
    .from("seo_tasks")
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort: number }>();

  const { error } = await svc.from("seo_tasks").insert({
    titolo,
    perche: perche || null,
    categoria,
    priorita,
    sort: (ultimo?.sort ?? 0) + 10,
  });
  if (error) torna(`Non è stata aggiunta: ${error.message}`, "warn");

  revalidatePath("/admin/seo");
  torna("Aggiunta.");
}
