"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Il cliente chiede (o smette di chiedere) la fattura.
 *
 *  Nel regime scelto la norma è la ricevuta e la fattura è l'eccezione: questi
 *  dati li chiediamo SOLO a chi la vuole, e solo quando la vuole. Chiederli a
 *  tutti in registrazione sarebbe attrito nel punto peggiore, oltre che dati
 *  raccolti senza motivo per la maggioranza.
 *
 *  Vale da qui in avanti: le fatture dei mesi già incassati si richiedono a
 *  ops, perché rifare un documento su un periodo chiuso non è una cosa che il
 *  cliente debba poter fare da solo. */
export async function salvaDatiFattura(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const vuole = formData.get("vuole") === "on";
  const pulisci = (k: string) => String(formData.get(k) ?? "").trim() || null;

  const cf = pulisci("tax_code")?.toUpperCase() ?? null;
  const piva = pulisci("vat")?.replace(/\s/g, "") ?? null;

  if (vuole) {
    // Per una fattura elettronica serve almeno uno dei due identificativi:
    // senza, lo SdI la scarta e il cliente non riceve niente.
    if (!cf && !piva) return { ok: false, error: "Serve il codice fiscale (o la partita IVA se fatturi come azienda)." };
    if (cf && !piva && !/^[A-Z0-9]{16}$/.test(cf)) return { ok: false, error: "Il codice fiscale deve avere 16 caratteri." };
    if (piva && !/^\d{11}$/.test(piva)) return { ok: false, error: "La partita IVA deve avere 11 cifre." };
    if (!pulisci("billing_name")) return { ok: false, error: "Indica l'intestazione della fattura." };
  }

  // Service role: il trigger della 0037 protegge ruolo, lavanderia e codice
  // cliente; questi campi non lo riguardano.
  const { error } = await createServiceClient()
    .from("profiles")
    .update({
      billing_wants_invoice: vuole,
      billing_name: pulisci("billing_name"),
      billing_address: pulisci("billing_address"),
      billing_cap: pulisci("billing_cap"),
      billing_city: pulisci("billing_city"),
      billing_tax_code: cf,
      billing_vat: piva,
      billing_sdi: pulisci("sdi")?.toUpperCase() ?? null,
      billing_pec: pulisci("pec"),
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/abbonamento");
  revalidatePath("/app/profilo");
  return { ok: true };
}
