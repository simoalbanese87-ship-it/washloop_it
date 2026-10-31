import { LEGAL } from "@/lib/legal";
import { CAP_MILANO, CAP_COMUNI } from "@/lib/copertura";

/** Dove passiamo davvero, scritto una volta sola.
 *
 *  I CAP non si elencano qui: si prendono da `copertura.ts`, che è la stessa
 *  regola con cui il sito risponde a chi scrive il suo CAP. Prima erano dieci
 *  numeri copiati a mano — quelli della sola zona Sud-Ovest — con un commento
 *  che chiedeva di aggiornarli il giorno in cui la copertura fosse cambiata.
 *  Quel giorno è arrivato il 1° ottobre 2026, e nessuno sarebbe andato a
 *  cercarli: una promessa pubblica che va ricopiata a mano è una promessa che
 *  prima o poi dice il falso.
 *
 *  Perché contano: «Milano» in una pagina la scrivono tutti. I CAP e i nomi dei
 *  quartieri sono le parole che una persona cerca davvero («lavanderia a
 *  domicilio Navigli»), e sono anche le uniche verificabili. */
export const CAP_SERVITI: readonly string[] = [...CAP_MILANO, ...CAP_COMUNI];

/** I nomi con cui la gente chiama quelle zone. Solo quelli di cui siamo certi:
 *  un quartiere elencato per sbaglio è una promessa di copertura che poi
 *  qualcuno ci chiede di mantenere. */
export const ZONE_SERVITE = [
  "Navigli", "Ticinese", "Tortona", "Solari", "Barona",
  "Famagosta", "Lorenteggio", "Bande Nere", "Sant'Ambrogio",
] as const;

/** Fuori città. Sono i tre nominati anche nelle FAQ: stessa promessa, stesse
 *  parole. */
export const COMUNI_SERVITI = ["Assago", "Buccinasco", "Rozzano"] as const;

/** L'attività, come la deve vedere un motore di ricerca.
 *
 *  Il tipo è `DryCleaningOrLaundry`, che è la voce esatta di schema.org per una
 *  lavanderia: dirsi genericamente `LocalBusiness` sarebbe vero e inutile.
 *  L'indirizzo e la partita IVA arrivano da `LEGAL`, la stessa fonte del piè di
 *  pagina e delle pagine legali — così non può succedere che il dato pubblico e
 *  il dato dichiarato a Google raccontino due aziende diverse. */
/** La scheda Google, ricavata dal link delle recensioni.
 *
 *  `GOOGLE_REVIEW_URL` è `https://g.page/r/<id>/review`: togliendo `/review`
 *  resta l'indirizzo della scheda. Si ricava invece di tenere una seconda
 *  variabile perché due variabili che devono puntare alla stessa scheda, prima
 *  o poi, puntano a due schede diverse — e di schede, qui, ne gira già una di
 *  troppo (il duplicato da unire). */
function schedaGoogle(): string | null {
  const review = process.env.GOOGLE_REVIEW_URL?.trim();
  if (!review) return null;
  return review.replace(/\/review\/?$/, "");
}

export function attivitaJsonLd() {
  const scheda = schedaGoogle();
  return {
    "@type": "DryCleaningOrLaundry",
    "@id": "https://washloop.it/#attivita",
    name: LEGAL.brand,
    legalName: LEGAL.company,
    vatID: LEGAL.vat,
    url: "https://washloop.it",
    email: "info@washloop.it",
    telephone: LEGAL.phone,
    image: "https://washloop.it/logo-washloop.png",
    priceRange: "€€",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Via Franco Russoli 9",
      addressLocality: "Milano",
      postalCode: "20143",
      addressRegion: "MI",
      addressCountry: "IT",
    },
    areaServed: [
      { "@type": "City", name: "Milano" },
      ...COMUNI_SERVITI.map((c) => ({ "@type": "City", name: c })),
    ],
    // Chi c'è dietro, con un nodo suo.
    //
    // Un servizio a cui si consegnano i vestiti di casa si sceglie anche per
    // questo: un'azienda senza una persona in cima è un'azienda che, se
    // qualcosa va storto, non si sa a chi chiedere. Il nodo ha un `@id` così
    // la pagina Chi siamo può parlare della stessa persona invece di
    // dichiararne una seconda con lo stesso nome.
    founder: { "@id": FONDATORE_ID },
    // `sameAs` e `hasMap` sono la frase «questo sito e quella scheda Google
    // sono la stessa azienda». Finché mancano, per Google sono due entità che
    // si assomigliano: il sito non aiuta la scheda a salire nella mappa, e la
    // scheda non presta al sito la fiducia delle sue recensioni. Costano due
    // righe e sono la metà del lavoro del punto «collega la scheda».
    ...(scheda ? { sameAs: [scheda], hasMap: scheda } : {}),
  };
}

/** L'identificativo del fondatore nel grafo. Una costante perché lo citano in
 *  due: l'azienda, che lo indica come `founder`, e la pagina Chi siamo, che lo
 *  descrive. */
export const FONDATORE_ID = "https://washloop.it/chi-siamo#simone";

/** Il fondatore, descritto. Lo emette solo la pagina Chi siamo: nelle altre
 *  basta il rimando, se no si dichiarerebbe la stessa persona su ogni pagina
 *  del sito. */
export function fondatoreJsonLd() {
  return {
    "@type": "Person",
    "@id": FONDATORE_ID,
    name: "Simone Albanese",
    jobTitle: "Fondatore",
    worksFor: { "@id": "https://washloop.it/#attivita" },
    url: "https://washloop.it/chi-siamo",
  };
}

/** Le domande della pagina, nel formato che Google può mostrare già aperte. */
export function faqJsonLd(faq: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** I due piani a listino, in euro al mese. Qui e non nel database perché i
 *  dati strutturati si scrivono quando la pagina viene costruita, e una
 *  lettura in più su ogni pagina pubblica per due numeri che cambiano una
 *  volta all'anno non vale il suo costo. Se cambiano a listino, si cambiano
 *  qui: sono due righe, e il commento dice perché esistono. */
export const PREZZO_LAVANDERIA = 160;
export const PREZZO_STIRO = 122;

/** Il servizio descritto dalla pagina, col suo prezzo vero.
 *
 *  Fino al 31 ottobre 2026 qui c'era un solo `Offer` da 160 €, su **tutte** le
 *  pagine: anche su quella del solo stiro, che costa 122. E le pagine
 *  generali dicevano «da 160 €» mentre il piano più economico ne costa 122 —
 *  chi confronta il testo con i dati strutturati trovava due prezzi minimi
 *  diversi, che è esattamente il genere di incoerenza che Google nota.
 *
 *  Adesso: una pagina che parla di un servizio solo dichiara il prezzo di quel
 *  servizio; una pagina che li racconta tutti e due dichiara un intervallo con
 *  il minimo vero. */
export function servizioJsonLd(
  nome: string,
  descrizione: string,
  url: string,
  /** Il prezzo da dichiarare. Un numero per una pagina di un servizio solo,
   *  `"tutti"` per le pagine generali. Vuoto = tutti, che è il caso storico. */
  prezzo: number | "tutti" = "tutti",
) {
  const offerta =
    prezzo === "tutti"
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: String(PREZZO_STIRO),
          highPrice: String(PREZZO_LAVANDERIA),
          offerCount: 2,
        }
      : {
          "@type": "Offer",
          priceCurrency: "EUR",
          price: String(prezzo),
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: String(prezzo),
            priceCurrency: "EUR",
            unitText: "mese",
          },
        };

  return {
    "@type": "Service",
    name: nome,
    description: descrizione,
    serviceType: nome,
    url,
    provider: { "@id": "https://washloop.it/#attivita" },
    areaServed: [
      { "@type": "City", name: "Milano" },
      ...COMUNI_SERVITI.map((c) => ({ "@type": "City", name: c })),
    ],
    offers: { ...offerta, availableAtOrFrom: { "@id": "https://washloop.it/#attivita" } },
  };
}

/** Il grafo completo di una pagina: attività + servizio + eventuali domande, in
 *  un blocco solo. Tre `<script>` separati funzionano, ma così i nodi possono
 *  citarsi fra loro con `@id` — ed è quello che lega «questo servizio» a
 *  «questa azienda».
 *
 *  `faq` è facoltativa, e il motivo non è comodità: Google accetta il blocco
 *  `FAQPage` **solo se quelle domande sono visibili nella pagina**. Dichiararle
 *  su una pagina che non le mostra è una violazione delle sue regole, non
 *  un'ottimizzazione — e si paga con la rimozione dei risultati arricchiti. */
export function graficoPagina(args: {
  nomeServizio: string;
  descrizione: string;
  url: string;
  faq?: { q: string; a: string }[];
  /** Il prezzo che questa pagina dichiara: un numero se parla di un servizio
   *  solo, altrimenti l'intervallo dei due piani. */
  prezzo?: number | "tutti";
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      attivitaJsonLd(),
      servizioJsonLd(args.nomeServizio, args.descrizione, args.url, args.prezzo),
      ...(args.faq?.length ? [faqJsonLd(args.faq)] : []),
    ],
  };
}
