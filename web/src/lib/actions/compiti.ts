"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { allineaCompiti } from "@/lib/compiti-sync";

/** Spuntare un compito: il gesto che aggiorna due cose insieme.
 *
 *  Il compito è il promemoria, il profilo è il registro. Se si chiudesse solo
 *  il compito, il cron notturno lo rifarebbe nascere — e avrebbe ragione,
 *  perché dal profilo risulterebbe che quel cliente non ha ancora niente in
 *  mano. Per questo la spunta non è un `update` su una tabella sola, e per
 *  questo passa da qui e non da una scrittura diretta del browser. */

const REV = ["/courier", "/admin/compiti", "/admin/etichette"] as const;
const rivaluta = () => REV.forEach((p) => revalidatePath(p));

type Compito = { id: string; tipo: string; customer_id: string; assegnato_a: string | null; stato: string };

async function compitoMio(compitoId: string): Promise<{ c: Compito; meId: string } | { errore: string }> {
  const me = await getCurrentProfile();
  if (!me || (me.role !== "courier" && me.role !== "admin")) return { errore: "Non autorizzato" };

  const svc = createServiceClient();
  const { data: c } = await svc
    .from("compiti")
    .select("id, tipo, customer_id, assegnato_a, stato")
    .eq("id", compitoId)
    .maybeSingle<Compito>();
  if (!c) return { errore: "Compito non trovato" };
  // Il rider può toccare solo i suoi: con un id in mano, altrimenti potrebbe
  // chiudere il compito di un collega e farlo sparire dal giro di quello.
  if (me.role === "courier" && c.assegnato_a !== me.id) return { errore: "Questo compito non è tuo" };
  if (c.stato !== "aperto") return { errore: "Compito già chiuso" };
  return { c, meId: me.id };
}

/** Il rider — o l'admin — segna il compito come fatto, e aggiorna il profilo.
 *
 *  `qty` sono i sacchi lasciati, e conta solo sulla dotazione. */
export async function segnaCompitoFatto(compitoId: string, qty = 2): Promise<{ ok: boolean; error?: string }> {
  const esito = await compitoMio(compitoId);
  if ("errore" in esito) return { ok: false, error: esito.errore };
  const { c, meId } = esito;

  const svc = createServiceClient();
  const adesso = new Date().toISOString();
  const quanti = Math.min(20, Math.max(1, Math.round(qty) || 2));

  if (c.tipo === "dotazione") {
    // Si scrive solo quello che manca. Chi aveva già i cartellini da settembre
    // non deve vedersi riscritta quella data a oggi: quella data è il quando è
    // successo, e serve a sapere da quanto quel cliente è in strada.
    const { data: prof } = await svc
      .from("profiles")
      .select("tags_delivered_at, borsa_consegnata_at")
      .eq("id", c.customer_id)
      .maybeSingle<{ tags_delivered_at: string | null; borsa_consegnata_at: string | null }>();

    const patch: Record<string, unknown> = {};
    if (!prof?.tags_delivered_at) {
      patch.tags_delivered_at = adesso;
      patch.tags_qty = quanti;
      patch.tags_delivered_by = meId;
    }
    if (!prof?.borsa_consegnata_at) {
      patch.borsa_consegnata_at = adesso;
      patch.borsa_qty = quanti;
    }
    // Un cliente che riparte dopo una chiusura: il materiale è di nuovo suo.
    patch.materiale_rientrato_at = null;
    const { error } = await svc.from("profiles").update(patch).eq("id", c.customer_id).eq("role", "customer");
    if (error) return { ok: false, error: error.message };
  } else if (c.tipo === "rientro") {
    const { error } = await svc
      .from("profiles")
      .update({ materiale_rientrato_at: adesso })
      .eq("id", c.customer_id)
      .eq("role", "customer");
    if (error) return { ok: false, error: error.message };
  }

  const { error } = await svc
    .from("compiti")
    .update({ stato: "fatto", fatto_at: adesso, fatto_da: meId })
    .eq("id", c.id)
    .eq("stato", "aperto");
  if (error) return { ok: false, error: error.message };

  rivaluta();
  return { ok: true };
}

/** Dove tornare dopo un'azione dal pannello. Solo percorsi interni. */
function tornaA(formData: FormData): string {
  const back = String(formData.get("back") ?? "").trim();
  return /^\/admin\/[A-Za-z0-9/_-]*(\?[A-Za-z0-9_=&%.-]*)?$/.test(back) ? back : "/admin/compiti";
}
const con = (dove: string, chiave: "ok" | "warn", testo: string) =>
  `${dove}${dove.includes("?") ? "&" : "?"}${chiave}=${encodeURIComponent(testo)}`;

/** La stessa spunta, dal pannello. */
export async function segnaCompitoFattoDalPannello(formData: FormData) {
  const id = String(formData.get("compito_id") ?? "");
  const qty = parseInt(String(formData.get("qty") ?? "2"), 10);
  const dove = tornaA(formData);
  const r = await segnaCompitoFatto(id, Number.isFinite(qty) ? qty : 2);
  redirect(con(dove, r.ok ? "ok" : "warn", r.ok ? "Compito segnato come fatto." : r.error ?? "Non riuscito."));
}

/** Annulla un compito senza farlo: quando non serve più, o è nato sbagliato. */
export async function annullaCompito(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const id = String(formData.get("compito_id") ?? "");
  const perche = String(formData.get("perche") ?? "").trim().slice(0, 300) || "Annullato dal pannello.";
  const dove = tornaA(formData);

  const svc = createServiceClient();
  const { error } = await svc
    .from("compiti")
    .update({ stato: "annullato", annullato_at: new Date().toISOString(), annullato_perche: perche })
    .eq("id", id)
    .eq("stato", "aperto");
  if (error) redirect(con(dove, "warn", error.message));
  rivaluta();
  redirect(con(dove, "ok", "Compito annullato."));
}

/** A chi tocca. Serve quando il compito è nato senza rider — zone scoperte o
 *  rider diversi — e qualcuno deve comunque andarci. */
export async function assegnaCompito(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const id = String(formData.get("compito_id") ?? "");
  const rider = String(formData.get("rider_id") ?? "").trim();
  const dove = tornaA(formData);

  const svc = createServiceClient();
  const { error } = await svc
    .from("compiti")
    .update({ assegnato_a: rider || null })
    .eq("id", id)
    .eq("stato", "aperto");
  if (error) redirect(con(dove, "warn", error.message));
  rivaluta();
  redirect(con(dove, "ok", rider ? "Compito assegnato." : "Compito rimesso senza rider."));
}

/** Rigenera i compiti di un cliente adesso, senza aspettare la notte.
 *
 *  Serve dopo una correzione a mano — un profilo sistemato, un abbonamento
 *  riattivato dalla dashboard di Stripe — e serve a vedere subito se la regola
 *  fa quello che ci si aspetta. */
export async function ricalcolaCompiti(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const clienteId = String(formData.get("cliente_id") ?? "");
  const dove = tornaA(formData);
  if (!clienteId) redirect(con(dove, "warn", "Cliente mancante."));

  const e = await allineaCompiti(clienteId, "pannello");
  rivaluta();
  revalidatePath(`/admin/abbonati/${clienteId}`);
  const parti = [
    e.creati.length ? `${e.creati.length} da fare` : null,
    e.annullati.length ? `${e.annullati.length} annullati` : null,
  ].filter(Boolean);
  redirect(con(dove, "ok", parti.length ? `Ricalcolato: ${parti.join(", ")}.` : "Ricalcolato: niente da cambiare."));
}
