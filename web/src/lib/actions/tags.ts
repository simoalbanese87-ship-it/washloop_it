"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

const REV = "/admin/etichette";

/** Segna che un cliente ha ricevuto materialmente i suoi tag QR.
 *
 *  Serve a sapere chi manca. Il codice ce l'hanno tutti dalla registrazione,
 *  ma i cartellini glieli portiamo a mano: senza questo segno, con più di una
 *  manciata di clienti non c'è modo di ricostruire chi li ha già e chi no —
 *  nessun ordine e nessuna scansione lo dicono. */
export async function segnaTagConsegnati(formData: FormData) {
  // Solo admin: nell'app del rider non c'è (ancora) un pulsante per segnare la
  // consegna, e un permesso senza schermata che lo usi è solo superficie in più.
  // Quando servirà al rider si apre insieme al bottone, non prima.
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const clienteId = String(formData.get("cliente_id") ?? "");
  const qty = Math.min(20, Math.max(1, parseInt(String(formData.get("qty") ?? "2"), 10) || 2));
  if (!clienteId) redirect(`${REV}?warn=${encodeURIComponent("Cliente mancante.")}`);

  const svc = createServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({ tags_delivered_at: new Date().toISOString(), tags_qty: qty, tags_delivered_by: me.id })
    .eq("id", clienteId)
    .eq("role", "customer");
  if (error) redirect(`${REV}?warn=${encodeURIComponent(error.message)}`);

  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent(`Segnati ${qty} tag come consegnati.`)}`);
}

/** Annulla la consegna: il cliente torna tra quelli a cui i tag mancano.
 *  Serve quando si segna il cliente sbagliato, o quando i tag si perdono e
 *  vanno rifatti. */
export async function annullaTagConsegnati(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const clienteId = String(formData.get("cliente_id") ?? "");
  if (!clienteId) redirect(`${REV}?warn=${encodeURIComponent("Cliente mancante.")}`);

  const svc = createServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({ tags_delivered_at: null, tags_qty: null, tags_delivered_by: null })
    .eq("id", clienteId)
    .eq("role", "customer");
  if (error) redirect(`${REV}?warn=${encodeURIComponent(error.message)}`);

  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent("Cliente rimesso tra quelli senza tag.")}`);
}
