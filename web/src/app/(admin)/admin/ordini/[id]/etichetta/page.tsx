import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Vecchia etichetta per singolo ordine — sostituita dai tag per cliente.
 *
 *  Stampava sul cartellino attaccato al sacco il nome, il telefono e
 *  l'indirizzo del cliente, più il nome della lavanderia. Quel cartellino
 *  viaggia fino al banco della lavanderia, che per costruzione non deve sapere
 *  di chi sia il bucato: tutte le viste del portale partner mostrano solo
 *  `WL-####`, e questa stampa annullava quella protezione. Il nome della
 *  lavanderia, che non deve vedere nessuno, tornava poi a casa del cliente.
 *
 *  Era anche concettualmente sbagliata: il QR contiene il codice CLIENTE, che
 *  non cambia mai, quindi a ogni ordine ristampava lo stesso identico QR.
 *
 *  Il vecchio indirizzo resta valido e porta al foglio di tag del cliente:
 *  chiunque avesse salvato il link non trova una pagina morta. */
export default async function EtichettaOrdinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("customer_id")
    .eq("id", id)
    .maybeSingle<{ customer_id: string | null }>();

  if (!order?.customer_id) notFound();
  redirect(`/admin/etichette?c=${order.customer_id}&n=2`);
}
