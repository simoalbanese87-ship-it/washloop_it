import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { meseRoma } from "@/lib/mese-roma";

/** La cassa: quanto è entrato e quanto è uscito, contato per il giorno in cui
 *  i soldi si sono mossi.
 *
 *  Il problema che risolve
 *  -----------------------
 *  Il 30 ottobre la Home diceva «690,60 € incassato questo mese» e la pagina
 *  Incassi, per lo stesso mese, «733,10 €». Due pagine, due numeri, nessuna
 *  delle due sbagliata nel calcolo: contavano due cose diverse.
 *
 *  La Home leggeva **Stripe** — le fatture pagate — e perdeva per strada i
 *  pagamenti che una fattura non ce l'hanno: un checkout `payment` emette solo
 *  un PaymentIntent, e quei 30,50 € non comparivano da nessuna parte. La
 *  pagina Incassi leggeva il **database**, ma toglieva ogni rimborso dal mese
 *  della ricevuta invece che dal mese in cui il denaro era uscito: un rimborso
 *  fatto il 12 ottobre su una ricevuta di settembre non toglieva niente a
 *  ottobre.
 *
 *  La regola, una sola
 *  -------------------
 *  **Si conta per la data in cui i soldi si muovono.** Entra: `incassato_at`.
 *  Esce: `rimborsato_at`. Tutto quello che è passato dal conto, fattura Stripe
 *  o no. Nient'altro.
 *
 *  Non è il conto di competenza — quello sta in `/admin/competenza` e risponde
 *  a un'altra domanda, «di che mese è questo ricavo». Qui si risponde a
 *  «quanto è entrato in cassa», che è la domanda che si fa guardando la Home.
 *
 *  Il database e non Stripe
 *  ------------------------
 *  `invoices` contiene **tutti** i movimenti, fatture e pagamenti singoli;
 *  Stripe, interrogato per fatture, non può contenere i secondi. Il registro è
 *  allineato — a ottobre le due fonti danno la stessa cifra sulle fatture — e
 *  quando non lo fosse c'è «Rileggi gli incassi da Stripe», che è il posto
 *  giusto per ripararlo: una volta, su un bottone, invece che a ogni lettura
 *  di ogni pagina.
 *
 *  **Col service client.** Su `invoices` il cliente legge solo le sue righe, e
 *  una policy che nega non dà errore: torna una lista vuota. Un totale di
 *  cassa a zero per sbaglio è peggio di nessun totale. */

export { meseRoma, meseCorrente, confiniMeseRoma } from "@/lib/mese-roma";

export type Cassa = {
  /** Quanto è entrato. */
  lordoCents: number;
  /** Quanto è uscito: rimborsi, per il giorno in cui sono usciti. */
  rimborsiCents: number;
  /** La differenza, cioè la cassa. Può essere negativa in un mese di rimborsi. */
  nettoCents: number;
  /** Quanti movimenti in entrata. */
  quanti: number;
  /** Quanto è entrato da pagamenti **senza fattura Stripe**: i checkout
   *  singoli, che emettono solo un PaymentIntent. Sono per forza fuori
   *  abbonamento, e serve saperlo a chi divide il grafico in canoni ed extra. */
  senzaFatturaCents: number;
};

export const CASSA_VUOTA: Cassa = { lordoCents: 0, rimborsiCents: 0, nettoCents: 0, quanti: 0, senzaFatturaCents: 0 };

/** Una riga nata da un pagamento singolo: su Stripe non c'è nessuna fattura,
 *  solo il PaymentIntent, e il suo identificativo comincia per `pi_`. */
const senzaFattura = (id: string | null) => !!id && !id.startsWith("in_");

type RigaEntrata = { amount_cents: number; incassato_at: string | null; created_at: string; stripe_invoice_id: string | null };
type RigaUscita = { rimborsato_cents: number | null; rimborsato_at: string };

/** La data dei soldi di una riga. `incassato_at` è la colonna giusta; il
 *  ripiego su `created_at` serve solo a una riga nata prima della 0112 e mai
 *  travasata, che non dovrebbe esistere. */
const quandoEntrato = (r: RigaEntrata) => r.incassato_at ?? r.created_at;

/** La cassa fra due istanti. Estremi inclusivo-esclusivo, come ovunque.
 *
 *  Gli estremi sono facoltativi: senza, si conta da sempre a sempre. Chi
 *  chiama non deve costruirsi un «adesso» — in una pagina quello sarebbe un
 *  `Date.now()` dentro il render, che è proprio il genere di cosa che rende un
 *  totale diverso a ogni ricarica. */
export async function cassaTraLe(svc: SupabaseClient, dalIso?: string | null, alIso?: string | null): Promise<Cassa> {
  const finestra = <T>(q: T, colonna: string): T => {
    let x = q as unknown as { gte: (c: string, v: string) => unknown; lt: (c: string, v: string) => unknown };
    if (dalIso) x = x.gte(colonna, dalIso) as typeof x;
    if (alIso) x = x.lt(colonna, alIso) as typeof x;
    return x as unknown as T;
  };

  const [entrate, uscite] = await Promise.all([
    finestra(
      svc.from("invoices").select("amount_cents, incassato_at, created_at, stripe_invoice_id"),
      "incassato_at",
    ).returns<RigaEntrata[]>(),
    finestra(
      svc.from("invoices").select("rimborsato_cents, rimborsato_at").not("rimborsato_at", "is", null),
      "rimborsato_at",
    ).returns<RigaUscita[]>(),
  ]);

  const lordoCents = (entrate.data ?? []).reduce((t, r) => t + (r.amount_cents ?? 0), 0);
  const rimborsiCents = (uscite.data ?? []).reduce((t, r) => t + (r.rimborsato_cents ?? 0), 0);
  return {
    lordoCents,
    rimborsiCents,
    nettoCents: lordoCents - rimborsiCents,
    quanti: (entrate.data ?? []).length,
    senzaFatturaCents: (entrate.data ?? [])
      .filter((r) => senzaFattura(r.stripe_invoice_id))
      .reduce((t, r) => t + (r.amount_cents ?? 0), 0),
  };
}

/** La cassa mese per mese, da un istante a oggi. Chiave `YYYY-MM` di Roma.
 *
 *  Una lettura sola e poi si raggruppa: dodici query per dodici barre di un
 *  grafico sono dodici occasioni di aspettare. */
export async function cassaPerMese(svc: SupabaseClient, dalIso: string): Promise<Map<string, Cassa>> {
  const [entrate, uscite] = await Promise.all([
    svc
      .from("invoices")
      .select("amount_cents, incassato_at, created_at, stripe_invoice_id")
      .gte("incassato_at", dalIso)
      .returns<RigaEntrata[]>(),
    svc
      .from("invoices")
      .select("rimborsato_cents, rimborsato_at")
      .not("rimborsato_at", "is", null)
      .gte("rimborsato_at", dalIso)
      .returns<RigaUscita[]>(),
  ]);

  const per = new Map<string, Cassa>();
  const tocca = (chiave: string) => {
    const c = per.get(chiave) ?? { ...CASSA_VUOTA };
    per.set(chiave, c);
    return c;
  };

  for (const r of entrate.data ?? []) {
    const c = tocca(meseRoma(quandoEntrato(r)));
    c.lordoCents += r.amount_cents ?? 0;
    c.quanti += 1;
    if (senzaFattura(r.stripe_invoice_id)) c.senzaFatturaCents += r.amount_cents ?? 0;
  }
  for (const r of uscite.data ?? []) {
    tocca(meseRoma(r.rimborsato_at)).rimborsiCents += r.rimborsato_cents ?? 0;
  }
  for (const c of per.values()) c.nettoCents = c.lordoCents - c.rimborsiCents;

  return per;
}
