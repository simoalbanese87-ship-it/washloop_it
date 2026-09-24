import "server-only";
import { stripe } from "@/lib/stripe";

/** Quali modi di pagare accettiamo, e la verifica che Stripe non ne aggiunga altri.
 *
 *  La decisione
 *  ------------
 *  Carta (che porta con sé Apple Pay e Google Pay), Link e Amazon Pay. Niente
 *  pagamenti a rate: il «compra ora, paghi poi» serve a rendere sostenibile un
 *  acquisto grosso e una tantum, costa circa un punto e mezzo in più di
 *  commissione, e noi vendiamo un abbonamento mensile che nessuno ha bisogno di
 *  rateizzare. Apple Pay e Google Pay non si elencano: viaggiano su `card`, e
 *  nominarli separatamente farebbe rifiutare la chiamata da Stripe.
 *
 *  Perché servono due liste
 *  ------------------------
 *  Non tutti i metodi che valgono a un checkout valgono anche su una fattura.
 *  Un metodo non supportato lì non dà un avviso: fa fallire la creazione della
 *  fattura, e in `incasso-extra.ts` un fallimento diventa un incasso mancato.
 *  Per questo la lista delle fatture è più stretta, e resterà tale finché non
 *  avremo la conferma — da Stripe, non da una supposizione — che Amazon Pay
 *  passa anche di lì.
 *
 *  Il buco che questa lista non chiude
 *  -----------------------------------
 *  Passare la lista vale per le pagine che apriamo noi. La pagina di pagamento
 *  di una fattura rimasta aperta — quella il cui link mandiamo al cliente
 *  quando il prelievo viene rifiutato — la disegna Stripe, e se lì non si dice
 *  niente mostra tutto ciò che è acceso sull'account. È il motivo per cui
 *  `metodiOffertiDaStripe()` esiste: l'unico modo di sapere cosa vedrebbe
 *  davvero il cliente è chiederlo a Stripe.
 */

/** Checkout: iscrizione e link di pagamento a prezzo personalizzato. */
export const METODI_CHECKOUT = ["card", "link", "amazon_pay"] as const;

/** Fatture create da noi (capi extra). Più stretta: vedi sopra. */
export const METODI_FATTURA = ["card", "link"] as const;

/** Nomi leggibili, per le pagine admin. Solo quelli che ci possono capitare. */
const NOMI: Record<string, string> = {
  card: "Carta",
  link: "Link",
  amazon_pay: "Amazon Pay",
  klarna: "Klarna",
  satispay: "Satispay",
  paypal: "PayPal",
  scalapay: "Scalapay",
  affirm: "Affirm",
  afterpay_clearpay: "Clearpay",
  alma: "Alma",
  bancontact: "Bancontact",
  sepa_debit: "Addebito SEPA",
  ideal: "iDEAL",
  revolut_pay: "Revolut Pay",
  sofort: "Sofort",
  p24: "Przelewy24",
  eps: "EPS",
  giropay: "Giropay",
  multibanco: "Multibanco",
  mobilepay: "MobilePay",
  twint: "TWINT",
  blik: "BLIK",
  cashapp: "Cash App Pay",
  billie: "Billie",
  zip: "Zip",
  sunbit: "Sunbit",
  crypto: "Cripto",
  pay_by_bank: "Bonifico istantaneo",
  us_bank_account: "Conto bancario USA",
  customer_balance: "Bonifico",
  wechat_pay: "WeChat Pay",
  alipay: "Alipay",
};

export function nomeMetodo(chiave: string): string {
  return NOMI[chiave] ?? chiave.replace(/_/g, " ");
}

/** Apple Pay e Google Pay sono portafogli che pagano con una carta: Stripe li
 *  elenca a parte nella configurazione, ma non sono metodi da passare al
 *  checkout, e la loro presenza non è una sorpresa da segnalare. */
const PORTAFOGLI_SU_CARTA = ["apple_pay", "google_pay", "samsung_pay", "link"];

export type MetodiStripe =
  | { ok: false; errore: string }
  | {
      ok: true;
      /** Nome della configurazione letta (Stripe ne permette più d'una). */
      configurazione: string;
      /** Tutti i metodi che Stripe mostrerebbe dove non passiamo la lista. */
      offerti: string[];
      /** Quelli che non abbiamo scelto noi: sono la risposta alla domanda. */
      inattesi: string[];
    };

/** Cosa Stripe offrirebbe su una pagina che non disegniamo noi.
 *
 *  Si legge la configurazione predefinita dei metodi di pagamento: per ogni
 *  metodo Stripe espone `available`, che è già la risposta giusta — vale `true`
 *  solo se il metodo è acceso **e** l'account ha la capacità attiva. Chiedere
 *  invece le capacità dell'account darebbe «attivo» anche per metodi spenti. */
export async function metodiOffertiDaStripe(): Promise<MetodiStripe> {
  if (!process.env.STRIPE_SECRET_KEY) return { ok: false, errore: "STRIPE_SECRET_KEY non configurata" };

  try {
    const lista = await stripe().paymentMethodConfigurations.list({ limit: 20 });
    const conf = lista.data.find((c) => c.is_default) ?? lista.data[0];
    if (!conf) return { ok: false, errore: "Stripe non ha nessuna configurazione dei metodi di pagamento" };

    // Si scorre l'oggetto invece di elencare i metodi uno per uno: quelli che
    // Stripe aggiunge nel tempo sono esattamente quelli che vogliamo vedere
    // comparire, e un elenco scritto a mano li mancherebbe tutti.
    const offerti = Object.entries(conf)
      .filter(([, v]) => typeof v === "object" && v !== null && (v as { available?: boolean }).available === true)
      .map(([k]) => k)
      .sort();

    const attesi = new Set<string>([...METODI_CHECKOUT, ...PORTAFOGLI_SU_CARTA]);
    return { ok: true, configurazione: conf.name, offerti, inattesi: offerti.filter((m) => !attesi.has(m)) };
  } catch (err) {
    return { ok: false, errore: err instanceof Error ? err.message : "errore sconosciuto" };
  }
}
