"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

const REV = "/admin/etichette";

/** Dove tornare dopo l'azione. Chi ripulisce i profili di prova lavora con
 *  `?prova=1` attivo: tornare senza farebbe sparire dalla vista proprio le
 *  righe su cui sta lavorando. Solo percorsi interni all'area riservata. */
function tornaA(formData: FormData): string {
  const back = String(formData.get("back") ?? "").trim();
  return /^\/admin\/[A-Za-z0-9/_-]*(\?[A-Za-z0-9_=&-]*)?$/.test(back) ? back : REV;
}

/** Aggiunge il messaggio all'indirizzo, rispettando la query che c'è già. */
const con = (dove: string, chiave: "ok" | "warn", testo: string) =>
  `${dove}${dove.includes("?") ? "&" : "?"}${chiave}=${encodeURIComponent(testo)}`;

/** Segna che un cliente ha ricevuto materialmente i suoi tag QR.
 *
 *  Serve a sapere chi manca. Il codice ce l'hanno tutti dalla registrazione,
 *  ma i cartellini glieli portiamo a mano: senza questo segno, con più di una
 *  manciata di clienti non c'è modo di ricostruire chi li ha già e chi no —
 *  nessun ordine e nessuna scansione lo dicono. */
export async function segnaTagConsegnati(formData: FormData) {
  // Questa è la versione da pannello, per correggere o registrare a posteriori.
  // Il caso normale è il rider che spunta dalla tappa: `riderSegnaTagConsegnati`.
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const clienteId = String(formData.get("cliente_id") ?? "");
  const qty = Math.min(20, Math.max(1, parseInt(String(formData.get("qty") ?? "2"), 10) || 2));
  const dove = tornaA(formData);
  if (!clienteId) redirect(con(dove, "warn", "Cliente mancante."));

  const svc = createServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({ tags_delivered_at: new Date().toISOString(), tags_qty: qty, tags_delivered_by: me.id })
    .eq("id", clienteId)
    .eq("role", "customer");
  if (error) redirect(con(dove, "warn", error.message));

  revalidatePath(REV);
  redirect(con(dove, "ok", `Segnati ${qty} tag come consegnati.`));
}

/** Il rider segna di aver lasciato i tag, dalla scheda della tappa.
 *
 *  È lì che il gesto avviene davvero: incolla il cartellino sul sacco e lo
 *  spunta davanti al portone. Farlo registrare all'admin più tardi vorrebbe dire
 *  dipendere dal fatto che il rider si ricordi di dirglielo — cioè il buco che
 *  questa funzione esiste per chiudere.
 *
 *  Il rider non passa l'id del cliente ma quello dell'ORDINE, e il collegamento
 *  al cliente lo facciamo qui verificando che quell'ordine sia suo e ancora
 *  aperto: altrimenti, con l'id giusto in mano, potrebbe marcare chiunque. */
export async function riderSegnaTagConsegnati(orderId: string, qty = 2): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentProfile();
  if (!me || (me.role !== "courier" && me.role !== "admin")) return { ok: false, error: "Non autorizzato" };

  const svc = createServiceClient();
  const { data: ordine } = await svc
    .from("orders")
    .select("id, customer_id, courier_id, status")
    .eq("id", orderId)
    .maybeSingle<{ id: string; customer_id: string | null; courier_id: string | null; status: string }>();

  if (!ordine?.customer_id) return { ok: false, error: "Ordine non trovato" };
  if (me.role === "courier") {
    if (ordine.courier_id !== me.id) return { ok: false, error: "Questa tappa non è nel tuo giro" };
    if (["delivered", "completed", "cancelled"].includes(ordine.status)) {
      return { ok: false, error: "Tappa già chiusa" };
    }
  }

  const { error } = await svc
    .from("profiles")
    .update({
      tags_delivered_at: new Date().toISOString(),
      tags_qty: Math.min(20, Math.max(1, qty)),
      tags_delivered_by: me.id,
    })
    .eq("id", ordine.customer_id)
    .eq("role", "customer");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/courier");
  revalidatePath(REV);
  return { ok: true };
}

/** Annulla la consegna: il cliente torna tra quelli a cui i tag mancano.
 *  Serve quando si segna il cliente sbagliato, o quando i tag si perdono e
 *  vanno rifatti. */
export async function annullaTagConsegnati(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const clienteId = String(formData.get("cliente_id") ?? "");
  const dove = tornaA(formData);
  if (!clienteId) redirect(con(dove, "warn", "Cliente mancante."));

  const svc = createServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({ tags_delivered_at: null, tags_qty: null, tags_delivered_by: null })
    .eq("id", clienteId)
    .eq("role", "customer");
  if (error) redirect(con(dove, "warn", error.message));

  revalidatePath(REV);
  redirect(con(dove, "ok", "Cliente rimesso tra quelli senza tag."));
}
