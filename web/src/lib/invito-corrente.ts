import "server-only";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizzaCodice } from "@/lib/invito";

/** L'invito che la persona si sta portando dietro, se ce n'è uno.
 *
 *  Due strade, e servono tutte e due. Il cookie regge la navigazione — chi apre
 *  l'invito, gira per il sito e si iscrive mezz'ora dopo non perde l'amico — ma
 *  non regge un browser che blocca i cookie né un link aperto sul telefono e
 *  completato dal computer. Il parametro `?ref=` nei link copre quei casi, e
 *  non costa niente portarselo dietro.
 *
 *  Si legge anche il nome di chi invita, perché la cosa più utile che possiamo
 *  fare con questo dato è **mostrarlo**: un invito che resta invisibile fino al
 *  giorno del premio è un invito di cui nessuno si fida. */
export type InvitoCorrente = { codice: string; nome: string | null } | null;

export async function invitoCorrente(refDalLink?: string | null): Promise<InvitoCorrente> {
  const biscotti = await cookies();
  const codice = normalizzaCodice(refDalLink) ?? normalizzaCodice(biscotti.get("wl_invito")?.value);
  if (!codice) return null;

  const { data } = await createServiceClient()
    .from("profiles")
    .select("full_name, role")
    .eq("client_code", codice)
    .maybeSingle<{ full_name: string | null; role: string }>();
  if (!data || data.role !== "customer") return null;

  // Solo il nome: il cognome di chi invita non riguarda chi riceve l'invito.
  const nome = (data.full_name ?? "").trim().split(/\s+/)[0] || null;
  return { codice, nome };
}
