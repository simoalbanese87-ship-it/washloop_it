import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { incassiStripePerMese, type PezzoIncasso } from "@/lib/incassi-stripe";
import { cassaPerMese, CASSA_VUOTA } from "@/lib/cassa";
import { rinnoviDelMese, type SubPerRinnovo } from "@/lib/rinnovi-mese";

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
  /** Il mese in pila: canoni e extra già incassati, al netto dei rimborsi.
   *  Sommati fanno `totaleCents`. Servono a vedere **di cosa** è fatto un mese:
   *  un mese che cresce solo di extra e uno che cresce di abbonamenti non sono
   *  la stessa azienda. */
  canoniCents: number;
  extraCents: number;
  quanti: number;
  /** Il mese in cui siamo: si evidenzia. */
  corrente: boolean;
  /** Solo sul mese in corso: quanto entrerebbe ancora da qui a fine mese se
   *  tutti gli abbonamenti attivi si rinnovassero come previsto. Zero sui mesi
   *  chiusi, dove non c'è più niente da attendere. */
  attesoCents: number;
  /** Quanti rinnovi compongono quella cifra. */
  rinnoviAttesi: number;
};

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

  // **Il totale di ogni barra è la cassa**, la stessa che mostra il numero
  // grande sopra il grafico: entrate per `incassato_at`, rimborsi per
  // `rimborsato_at`. Prima il grafico leggeva Stripe e il numero grande anche,
  // ma la pagina Incassi no — e le due cifre si contraddicevano in mezzo
  // schermo. Adesso la fonte è una sola, per tutti.
  const cassa = await cassaPerMese(svc, dallIso);

  // A Stripe si chiede **solo di cosa è fatto** un mese: quanto di quel totale
  // sono canoni e quanto extra. È un'informazione che il registro non ha — il
  // `billing_reason` vive su Stripe — e non entra nel totale: se Stripe non
  // risponde, la barra resta alta uguale e si colora di un pezzo solo.
  const pezzoDi = new Map<string, PezzoIncasso>();
  const daStripe = await incassiStripePerMese(Math.floor(new Date(dallIso).getTime() / 1000), pezzoDi);

  const per = new Map<string, { totaleCents: number; quanti: number; canoniCents: number; extraCents: number }>();
  for (const [k, c] of cassa) {
    // Gli extra: quelli che Stripe riconosce come fuori abbonamento, più i
    // pagamenti singoli, che una fattura Stripe non ce l'hanno e sono extra
    // per definizione. Il resto è canone — così la somma delle due fette fa
    // sempre il totale, anche quando le due fonti non si trovano d'accordo.
    const extraStripe = daStripe?.get(k)?.extraCents ?? 0;
    const extra = Math.min(c.nettoCents, extraStripe + c.senzaFatturaCents);
    per.set(k, {
      totaleCents: c.nettoCents,
      quanti: c.quanti,
      canoniCents: Math.max(0, c.nettoCents - extra),
      extraCents: Math.max(0, extra),
    });
  }

  // I rinnovi ancora da incassare in questo mese. Si chiedono una volta sola,
  // fuori dal giro dei dodici mesi: riguardano solo quello in corso.
  const atteso = await rinnoviAncoraAttesi(svc, chiaveDi(oggi.anno, oggi.mese), includiProva);

  const fmtCorto = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "short" });
  const fmtLungo = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "long", year: "numeric" });

  const out: MeseIncassi[] = [];
  for (let i = quantiMesi - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(oggi.anno, oggi.mese - 1 - i, 1));
    const { anno, mese } = annoMeseRoma(d);
    const k = chiaveDi(anno, mese);
    const acc = per.get(k) ?? { ...CASSA_VUOTA, totaleCents: 0, canoniCents: 0, extraCents: 0 };
    const corrente = anno === oggi.anno && mese === oggi.mese;
    out.push({
      chiave: k,
      etichetta: fmtCorto.format(d).replace(".", ""),
      nome: fmtLungo.format(d),
      totaleCents: acc.totaleCents,
      canoniCents: acc.canoniCents,
      extraCents: acc.extraCents,
      quanti: acc.quanti,
      corrente,
      attesoCents: corrente ? atteso.totaleCents : 0,
      rinnoviAttesi: corrente ? atteso.quanti : 0,
    });
  }
  return out;
}

/** Gli abbonamenti che si rinnoveranno entro la fine del mese in corso.
 *
 *  La regola sta in `rinnovi-mese.ts`, che è collaudata; qui c'è solo la
 *  lettura. Una riga per cliente, la più recente: chi ha cambiato piano ha due
 *  righe in `subscriptions` e sommarle conterebbe due volte lo stesso cliente.
 */
async function rinnoviAncoraAttesi(
  svc: ReturnType<typeof createServiceClient>,
  meseChiave: string,
  includiProva: boolean,
) {
  const { data } = await svc
    .from("subscriptions")
    .select("user_id, status, cancel_at_period_end, cancel_at, custom_price_cents, current_period_end, created_at, plans(price_month_cents), profiles(is_test)")
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .returns<{
      user_id: string; status: string; cancel_at_period_end: boolean | null; cancel_at: string | null;
      custom_price_cents: number | null; current_period_end: string | null; created_at: string;
      plans: { price_month_cents: number } | null;
      profiles: { is_test: boolean } | null;
    }[]>();

  const vista = new Set<string>();
  const subs: SubPerRinnovo[] = [];
  for (const r of data ?? []) {
    if (vista.has(r.user_id)) continue;
    vista.add(r.user_id);
    if (!includiProva && r.profiles?.is_test) continue;
    subs.push({
      prezzoCents: r.custom_price_cents ?? r.plans?.price_month_cents ?? 0,
      periodEndIso: r.current_period_end,
      // Disdetta a fine periodo **o** a data: un abbonamento con «Data di
      // annullamento» non si rinnova, e contarlo nella proiezione gonfia il
      // mese prossimo di un canone che non arriverà.
      disdetto: r.cancel_at_period_end === true || !!r.cancel_at,
    });
  }
  return rinnoviDelMese(subs, meseChiave, Date.now());
}
