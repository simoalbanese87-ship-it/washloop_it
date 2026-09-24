"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { importaLeadFunnel } from "@/lib/funnel-import";

/** Import dei lead del funnel su richiesta.
 *
 *  Lo stesso lavoro del cron notturno, lanciato a mano: serve per provarlo
 *  subito dopo una modifica al foglio, senza aspettare le 5:15. Rieseguirlo non
 *  fa danni — i lead esistenti non si duplicano e lo stato del contatto non
 *  viene toccato. */
export async function importaFunnelOra() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");

  const esito = await importaLeadFunnel();
  revalidatePath("/admin/contatti");

  if (!esito.ok) redirect(`/admin/contatti?warn=${encodeURIComponent(`Import non riuscito: ${esito.errore}`)}`);
  redirect(
    `/admin/contatti?ok=${encodeURIComponent(
      `Foglio letto: ${esito.letti} righe · ${esito.nuovi} nuovi contatti · ${esito.aggiornati} completati.`,
    )}`,
  );
}
