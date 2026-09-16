import { LEGAL } from "@/lib/legal";

/** Dove passiamo davvero, scritto una volta sola.
 *
 *  I CAP non sono inventati per fare volume: sono quelli caricati in
 *  `zone_caps` sulla zona attiva, cioè gli stessi che il sito usa per dire a un
 *  cliente «sì, copriamo casa tua». Se domani ne aggiungiamo uno in pannello,
 *  questa lista va aggiornata qui — e il commento esiste perché quel giorno
 *  arriverà e la promessa pubblica non deve restare indietro.
 *
 *  Perché contano: «Milano» in una pagina la scrivono tutti. I CAP e i nomi dei
 *  quartieri sono le parole che una persona cerca davvero («lavanderia a
 *  domicilio Navigli»), e sono anche le uniche verificabili. */
export const CAP_SERVITI = [
  "20089", "20090", "20100", "20123", "20136",
  "20141", "20142", "20143", "20144", "20146",
] as const;

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
export function attivitaJsonLd() {
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

/** Il servizio descritto dalla pagina. `offers` con il prezzo di partenza vero:
 *  160 €/mese è il piano Small a listino, non un numero d'effetto. */
export function servizioJsonLd(nome: string, descrizione: string, url: string) {
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
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: "160",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "160",
        priceCurrency: "EUR",
        unitText: "mese",
      },
      availableAtOrFrom: { "@id": "https://washloop.it/#attivita" },
    },
  };
}

/** Il grafo completo di una pagina: attività + servizio + domande, in un blocco
 *  solo. Tre `<script>` separati funzionano, ma così i nodi possono citarsi fra
 *  loro con `@id` — ed è quello che lega «questo servizio» a «questa azienda». */
export function graficoPagina(args: {
  nomeServizio: string;
  descrizione: string;
  url: string;
  faq: { q: string; a: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      attivitaJsonLd(),
      servizioJsonLd(args.nomeServizio, args.descrizione, args.url),
      faqJsonLd(args.faq),
    ],
  };
}
