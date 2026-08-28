import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/** Registra un guasto, perché `console.error` non lo legge nessuno.
 *
 *  La regola di questo modulo è una sola: **non deve mai far fallire il codice
 *  che lo chiama**. Viene invocato dentro i `catch` di email, cron e webhook —
 *  posti dove qualcosa è già andato storto. Se anche la scrittura del guasto
 *  fallisse e lanciasse, trasformerebbe un'email non spedita in una richiesta
 *  in errore, e il rimedio sarebbe peggio del male. */

export type AreaGuasto = "email" | "cron" | "webhook" | "push" | "stripe" | "altro";

/** Ultimo invio per chiave, in questo processo. Un errore che si ripete in
 *  ciclo scriverebbe migliaia di righe identiche e renderebbe illeggibile il
 *  riepilogo: la prima volta si registra, per un minuto le successive no.
 *  È per processo e non globale — su più istanze qualche doppione passa — ma
 *  basta a fermare il caso che fa danno, cioè il ciclo stretto. */
const ultimoPer = new Map<string, number>();
const SILENZIO_MS = 60_000;

function troppoRavvicinato(chiave: string): boolean {
  const ora = Date.now();
  const prima = ultimoPer.get(chiave);
  if (prima != null && ora - prima < SILENZIO_MS) return true;
  ultimoPer.set(chiave, ora);
  // La mappa non deve crescere all'infinito in un processo longevo.
  if (ultimoPer.size > 200) {
    for (const [k, t] of ultimoPer) if (ora - t > SILENZIO_MS) ultimoPer.delete(k);
  }
  return false;
}

export async function registraGuasto(
  area: AreaGuasto,
  messaggio: string,
  dettaglio?: Record<string, unknown>,
): Promise<void> {
  try {
    const testo = (messaggio || "errore sconosciuto").slice(0, 500);
    if (troppoRavvicinato(`${area}|${testo}`)) return;
    await createServiceClient().from("incidenti").insert({ area, messaggio: testo, dettaglio: dettaglio ?? null });
  } catch (err) {
    // Ultima spiaggia: se non si riesce nemmeno a scrivere il guasto, resta il
    // log. Non si rilancia: vedi il commento in cima.
    console.error("[incidenti] impossibile registrare il guasto:", err);
  }
}

export type Guasto = { area: string; messaggio: string; quante: number; ultimo: string };

/** I guasti delle ultime `ore`, raggruppati: cento volte lo stesso errore è
 *  una riga con scritto cento, non cento righe da leggere. */
export async function guastiRecenti(ore = 24): Promise<Guasto[]> {
  const svc = createServiceClient();
  const da = new Date(Date.now() - ore * 3600_000).toISOString();
  const { data } = await svc
    .from("incidenti")
    .select("area, messaggio, created_at")
    .gte("created_at", da)
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<{ area: string; messaggio: string; created_at: string }[]>();

  const per = new Map<string, Guasto>();
  for (const r of data ?? []) {
    const k = `${r.area}|${r.messaggio}`;
    const g = per.get(k);
    if (g) {
      g.quante++;
      if (r.created_at > g.ultimo) g.ultimo = r.created_at;
    } else {
      per.set(k, { area: r.area, messaggio: r.messaggio, quante: 1, ultimo: r.created_at });
    }
  }
  return [...per.values()].sort((a, b) => (a.ultimo < b.ultimo ? 1 : -1));
}
