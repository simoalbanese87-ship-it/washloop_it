import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { waitlistLeads } from "@/lib/waitlist";
import { zoneIdForCap } from "@/lib/zones";

/** Porta i lead del funnel dentro la tabella `leads`.
 *
 *  Fino a ieri vivevano solo nel Google Sheet, letti in sola lettura: non si
 *  poteva cambiarne lo stato né convertirli in clienti, ed erano un elenco
 *  separato da quello della landing. Chi compilava entrambi i moduli compariva
 *  due volte, perché nessuno incrociava i due bacini.
 *
 *  Il foglio resta la sorgente e continua a riempirsi: qui lo copiamo, non lo
 *  sostituiamo. Il funnel non si tocca.
 *
 *  Regola importante: NON si sovrascrive il lavoro fatto a mano. Se il lead
 *  esiste già si completano soltanto i campi vuoti, e `contact_status` non si
 *  tocca mai — altrimenti l'import notturno riporterebbe a "da contattare" un
 *  contatto che hai appena chiuso. */

/** Ultimo import in questo processo: evita di rileggere il foglio a ogni
 *  ricaricamento della pagina. */
let ultimoImport = 0;

/** Importa se è passato abbastanza tempo. Chiamata all'apertura di Persone:
 *  i lead della landing entrano nel CRM all'istante (li scrive il modulo), ma
 *  quelli del funnel vivono in un foglio Google che nessuno ci notifica —
 *  l'unico modo di averli "subito" è andarli a prendere quando serve, cioè
 *  quando qualcuno apre la lista. Il cron notturno resta come rete di
 *  sicurezza per i giorni in cui nessuno la apre. */
export async function importaFunnelSeServe(minuti = 5): Promise<void> {
  if (Date.now() - ultimoImport < minuti * 60_000) return;
  ultimoImport = Date.now();
  try {
    await importaLeadFunnel();
  } catch (err) {
    console.error("[funnel] import all'apertura fallito:", err);
  }
}

export type EsitoImport = { ok: true; letti: number; nuovi: number; aggiornati: number } | { ok: false; errore: string };

/** Il CAP si estrae dall'indirizzo libero del foglio: cinque cifre consecutive. */
function capDa(indirizzo: string): string | null {
  const m = indirizzo.match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

/** Le risposte del questionario (Q1..Q5 e simili) diventano una nota leggibile.
 *  `leads.notes` esiste dalla prima migration e non l'ha mai usata nessuno. */
function notaDa(extra: { label: string; value: string }[]): string | null {
  const righe = extra.filter((e) => e.value?.trim()).map((e) => `${e.label}: ${e.value.trim()}`);
  return righe.length ? righe.join("\n") : null;
}

export async function importaLeadFunnel(): Promise<EsitoImport> {
  const foglio = await waitlistLeads();
  if (!foglio.ok) return { ok: false, errore: foglio.error };

  const svc = createServiceClient();
  let nuovi = 0;
  let aggiornati = 0;

  for (const l of foglio.leads) {
    const email = l.email?.trim().toLowerCase();
    // Senza email non c'è chiave: la riga resta nel foglio, dove la si legge.
    if (!email || !email.includes("@")) continue;

    const cap = capDa(l.address ?? "");
    const { data: esistente } = await svc
      .from("leads")
      .select("id, full_name, phone, cap, notes, source")
      .eq("email", email)
      .maybeSingle<{ id: string; full_name: string | null; phone: string | null; cap: string | null; notes: string | null; source: string | null }>();

    if (esistente) {
      // Solo i buchi. Chi è arrivato prima dalla landing resta "landing": la
      // prima provenienza è quella che conta per capire cosa ha funzionato.
      const patch: Record<string, unknown> = {};
      if (!esistente.full_name && l.name) patch.full_name = l.name;
      if (!esistente.phone && l.phone) patch.phone = l.phone;
      if (!esistente.cap && cap) patch.cap = cap;
      if (!esistente.notes) {
        const nota = notaDa(l.extra ?? []);
        if (nota) patch.notes = nota;
      }
      if (Object.keys(patch).length) {
        await svc.from("leads").update(patch).eq("id", esistente.id);
        aggiornati++;
      }
      continue;
    }

    const zoneId = cap ? await zoneIdForCap(svc, cap) : null;
    const { error } = await svc.from("leads").insert({
      full_name: l.name || "—",
      email,
      phone: l.phone || null,
      cap,
      zone_id: zoneId,
      covered: zoneId !== null,
      source: "funnel",
      notes: notaDa(l.extra ?? []),
      // La data del foglio, non quella dell'import: altrimenti i lead vecchi
      // sembrerebbero arrivati tutti stanotte.
      created_at: l.date ?? new Date().toISOString(),
    });
    if (error) {
      console.error(`[funnel] import di ${email} fallito:`, error.message);
      continue;
    }
    nuovi++;
  }

  return { ok: true, letti: foglio.leads.length, nuovi, aggiornati };
}
