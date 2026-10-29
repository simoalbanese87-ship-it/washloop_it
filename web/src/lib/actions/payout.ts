"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

const REV = "/admin/lavanderia";

/** Segna come pagato tutto il dovuto a una lavanderia per un mese.
 *
 *  Due stati e non quattro: "maturato" e "pagato". Un flusso con verifica,
 *  approvazione e pagamento avrebbe senso con decine di partner e migliaia di
 *  righe; con una lavanderia sarebbe una procedura da compilare per finta.
 *
 *  Non tocca le righe annullate (`void`): un capo rimosso o rimborsato non si
 *  paga, e riportarlo in vita per errore sarebbe denaro regalato. */
export async function segnaMesePagato(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const laundryId = String(formData.get("laundry_id") ?? "");
  const mese = String(formData.get("mese") ?? ""); // YYYY-MM
  if (!laundryId || !/^\d{4}-\d{2}$/.test(mese)) {
    redirect(`${REV}?warn=${encodeURIComponent("Periodo non valido.")}`);
  }

  // Gli estremi si scrivono come date, non come istanti: `servizio_il` è un
  // giorno, e confrontarlo con un timestamp UTC farebbe cadere fuori l'ultimo
  // giorno del mese a seconda del fuso.
  const inizio = `${mese}-01`;
  const [anno, m] = mese.split("-").map(Number);
  const fine = `${m === 12 ? anno + 1 : anno}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;

  const svc = createServiceClient();
  const { error, count } = await svc
    .from("laundry_payouts")
    // La data del pagamento, non solo il fatto: la lavanderia deve poterla
    // confrontare con l'estratto conto. «Pagato» senza quando non si verifica.
    .update({ status: "settled", paid_at: new Date().toISOString() }, { count: "exact" })
    .eq("laundry_id", laundryId)
    .eq("status", "pending")
    // Sul mese del servizio, esattamente come la pagina che si sta guardando:
    // se i due criteri divergessero, il bottone liquiderebbe righe diverse da
    // quelle del totale appena letto.
    .gte("servizio_il", inizio)
    .lt("servizio_il", fine);

  if (error) redirect(`${REV}?warn=${encodeURIComponent(error.message)}`);

  revalidatePath(REV);
  redirect(`${REV}?ok=${encodeURIComponent(`Segnate come pagate ${count ?? 0} voci di ${mese}.`)}`);
}

/** Un costo verso la lavanderia che non nasce da nessun ordine.
 *
 *  Serve quando un capo è stato lavorato **fuori dal sacco**: consegnato a
 *  mano, o arrivato insieme a un ritiro di solo stiro dove quel lavoro non si
 *  può registrare. Dal portale la lavanderia non ha dove scriverlo — senza
 *  sacco non c'è la riga da compilare — e il compenso resterebbe un accordo a
 *  voce.
 *
 *  L'alternativa era inventare un ordine per far nascere il compenso. Ma un
 *  ordine finto finisce nel board e nel giro del rider, e quello che nasce come
 *  una scorciatoia contabile diventa un ritiro che qualcuno va a fare.
 *
 *  La nota non è decorativa: è l'unica cosa che, davanti al bonifico di fine
 *  mese, spiega una riga che non ha un ordine dietro. Per questo è obbligatoria
 *  e non si accettano due parole buttate lì. */
export async function aggiungiCostoLavanderia(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const laundryId = String(formData.get("laundry_id") ?? "");
  const nota = String(formData.get("nota") ?? "").trim().slice(0, 300);
  const giorno = String(formData.get("servizio_il") ?? "").trim();
  const importoGrezzo = String(formData.get("importo_eur") ?? "").trim().replace(",", ".");
  const importo = Math.round(Number(importoGrezzo) * 100);

  if (!laundryId) redirect(`${REV}?warn=${encodeURIComponent("Scegli la lavanderia.")}`);
  if (!Number.isFinite(importo) || importo <= 0) {
    redirect(`${REV}?warn=${encodeURIComponent("Importo non valido: scrivi quanto dobbiamo alla lavanderia, in euro.")}`);
  }
  if (nota.length < 10) {
    redirect(`${REV}?warn=${encodeURIComponent("Scrivi perché: fra un mese, davanti al bonifico, è l'unica cosa che spiega questa riga.")}`);
  }
  // Il giorno del **servizio**, perché è con quello che si raggruppa e si
  // liquida. Vuoto = oggi, in ora di Roma.
  const servizioIl = /^\d{4}-\d{2}-\d{2}$/.test(giorno)
    ? giorno
    : new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

  const svc = createServiceClient();
  const { error } = await svc.from("laundry_payouts").insert({
    laundry_id: laundryId,
    order_id: null,
    special_id: null,
    kind: "manuale",
    amount_cents: importo,
    status: "pending",
    servizio_il: servizioIl,
    nota,
  });
  if (error) redirect(`${REV}?warn=${encodeURIComponent(`Costo non aggiunto: ${error.message}`)}`);

  revalidatePath(REV);
  revalidatePath("/admin/competenza");
  redirect(
    `${REV}?ok=${encodeURIComponent(
      `Aggiunto un costo di ${(importo / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })} verso la lavanderia, del ${servizioIl.slice(8, 10)}/${servizioIl.slice(5, 7)}.`,
    )}`,
  );
}
