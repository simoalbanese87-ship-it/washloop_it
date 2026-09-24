import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { incassiStripePerMese } from "@/lib/incassi-stripe";

/** Gli incassi mese per mese, per il grafico a barre della Home.
 *
 *  Il riquadro diceva «incassato questo mese» e, in piccolo, il totale da
 *  inizio anno: due numeri che non raccontano se stiamo salendo o scendendo.
 *  Con dodici barre si vede l'andamento in un colpo d'occhio, e ogni barra
 *  porta all'elenco dei clienti di quel mese.
 *
 *  I mesi senza incassi restano, a zero: un buco nella serie è un'informazione,
 *  saltarlo farebbe sembrare continuo un andamento che non lo è. */

export type MeseIncassi = {
  /** Chiave stabile per i link e l'ordinamento: `2026-08`. */
  chiave: string;
  /** Etichetta corta sotto la barra: `ago`. */
  etichetta: string;
  /** Nome esteso per la descrizione accessibile: `agosto 2026`. */
  nome: string;
  totaleCents: number;
  quanti: number;
  /** Il mese in cui siamo: si evidenzia. */
  corrente: boolean;
};

/** Da dove escono i numeri. Serve a dirlo in pagina: un totale non verificabile
 *  vale meno di un totale che dichiara la propria fonte. */
export type FonteIncassi = "stripe" | "registro";

/** Anno e mese in ora di Roma: usare `getMonth()` sposterebbe di un mese chi
 *  guarda il primo del mese a mezzanotte e mezza. */
function annoMeseRoma(d: Date): { anno: number; mese: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(d);
  const [anno, mese] = p.split("-").map(Number);
  return { anno, mese };
}

const chiaveDi = (anno: number, mese: number) => `${anno}-${String(mese).padStart(2, "0")}`;

export async function incassiMensili(includiProva = false, quantiMesi = 12): Promise<MeseIncassi[]> {
  const svc = createServiceClient();
  const oggi = annoMeseRoma(new Date());

  // Il primo giorno del mese più lontano che vogliamo mostrare.
  const daAnno = oggi.mese - (quantiMesi - 1) <= 0 ? oggi.anno - 1 : oggi.anno;
  const daMese = ((oggi.mese - (quantiMesi - 1) - 1 + 12) % 12) + 1;
  const dallIso = new Date(Date.UTC(daAnno, daMese - 1, 1)).toISOString();

  // Prima si chiede a Stripe, che è dove i soldi arrivano davvero. La tabella
  // `invoices` resta come ripiego, ma da sola non basta: si popola da un webhook
  // che non arriva, quindi ogni mese risultava a zero mentre gli abbonamenti
  // venivano pagati.
  const daStripe = await incassiStripePerMese(Math.floor(new Date(dallIso).getTime() / 1000));

  const per = new Map<string, { totaleCents: number; quanti: number }>();
  if (daStripe) {
    for (const [k, v] of daStripe) per.set(k, { totaleCents: v.totaleCents, quanti: v.quanti });
  } else {
    const { data: righe } = await svc
      .from("invoices")
      .select("amount_cents, created_at, profiles(is_test)")
      .gte("created_at", dallIso)
      .returns<{ amount_cents: number; created_at: string; profiles: { is_test: boolean } | null }[]>();
    for (const r of righe ?? []) {
      if (!includiProva && r.profiles?.is_test) continue;
      const { anno, mese } = annoMeseRoma(new Date(r.created_at));
      const k = chiaveDi(anno, mese);
      const acc = per.get(k) ?? { totaleCents: 0, quanti: 0 };
      acc.totaleCents += r.amount_cents ?? 0;
      acc.quanti++;
      per.set(k, acc);
    }
  }

  const fmtCorto = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "short" });
  const fmtLungo = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "long", year: "numeric" });

  const out: MeseIncassi[] = [];
  for (let i = quantiMesi - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(oggi.anno, oggi.mese - 1 - i, 1));
    const { anno, mese } = annoMeseRoma(d);
    const k = chiaveDi(anno, mese);
    const acc = per.get(k) ?? { totaleCents: 0, quanti: 0 };
    out.push({
      chiave: k,
      etichetta: fmtCorto.format(d).replace(".", ""),
      nome: fmtLungo.format(d),
      totaleCents: acc.totaleCents,
      quanti: acc.quanti,
      corrente: anno === oggi.anno && mese === oggi.mese,
    });
  }
  return out;
}
