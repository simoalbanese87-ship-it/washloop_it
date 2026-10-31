import type { MetadataRoute } from "next";
import { GUIDE, urlGuida } from "@/lib/guide";

/** Le pagine che vogliamo in un motore di ricerca.
 *
 *  Erano due — la home e, senza motivo, `/login` — e il risultato si è visto:
 *  cercando "washloop" Google metteva l'Informativa Privacy sotto la home,
 *  perché fra quello che aveva era l'unica altra pagina con del testo. Non
 *  sceglieva male: sceglieva fra poco.
 *
 *  Le legali sono uscite dall'indice (restano nel piè di pagina) e al loro
 *  posto ci sono le pagine che quel posto se lo meritano, una per ciascuna
 *  domanda che la gente digita davvero. `/disponibilita` resta fuori ed è
 *  voluto: serve alle campagne a pagamento e non deve competere in organico.
 *
 *  Dal 29 ottobre 2026 ci sono anche le pagine di zona e le guide. Le guide
 *  non sono scritte a mano qui: arrivano da `lib/guide.ts`, che è lo stesso
 *  elenco che disegna la pagina indice. Una guida pubblicata e dimenticata
 *  nella sitemap è una guida che Google scopre mesi dopo, se la scopre. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://washloop.it";
  const aggiornato = new Date("2026-09-24");
  const oggi = new Date("2026-10-29");

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1, lastModified: aggiornato },
    { url: `${base}/lavanderia-a-domicilio-milano`, changeFrequency: "monthly", priority: 0.9, lastModified: aggiornato },
    { url: `${base}/servizio-stiro-a-domicilio-milano`, changeFrequency: "monthly", priority: 0.9, lastModified: aggiornato },
    // I prezzi cambiano più spesso delle due pagine di servizio, e la pagina li
    // legge dal database: quando cambiano in pannello, cambia anche qui.
    { url: `${base}/prezzi`, changeFrequency: "weekly", priority: 0.9, lastModified: aggiornato },
    // «Come funziona», dal 17 ottobre 2026: è la pagina che si manda a chi
    // chiede, e intercetta chi cerca di capire prima di decidere. Priorità
    // alta quanto le due di servizio, perché risponde a una domanda diversa
    // dalle loro e non gli toglie posizioni.
    { url: `${base}/come-funziona`, changeFrequency: "monthly", priority: 0.9, lastModified: new Date("2026-10-17") },

    // Le tre zone. Priorità sotto le pagine di servizio e non uguale: sono
    // pagine che intercettano una domanda più stretta, e dirle importanti
    // quanto la pagina Milano sarebbe dire a Google una cosa che non pensiamo.
    { url: `${base}/lavanderia-a-domicilio-navigli`, changeFrequency: "monthly", priority: 0.8, lastModified: oggi },
    { url: `${base}/lavanderia-a-domicilio-barona-lorenteggio`, changeFrequency: "monthly", priority: 0.8, lastModified: oggi },
    { url: `${base}/lavanderia-a-domicilio-assago-buccinasco-rozzano`, changeFrequency: "monthly", priority: 0.8, lastModified: oggi },

    // Contatti: non porta ricerche, ma è la pagina che si cerca dopo aver letto
    // le altre, e la sua assenza era un buco di fiducia.
    { url: `${base}/chi-siamo`, changeFrequency: "yearly", priority: 0.6, lastModified: oggi },
    { url: `${base}/contatti`, changeFrequency: "yearly", priority: 0.5, lastModified: oggi },

    { url: `${base}/guide`, changeFrequency: "monthly", priority: 0.7, lastModified: oggi },
    ...GUIDE.map((g) => ({
      url: urlGuida(g.slug),
      changeFrequency: "yearly" as const,
      priority: 0.7,
      lastModified: new Date(g.aggiornata),
    })),

    // «Porta un amico»: la regola scritta per intero, per chi la cerca da fuori.
    // `/invita/[codice]` resta fuori dall'indice ed è voluto — parla di una
    // persona precisa e non ha senso in un motore di ricerca.
    { url: `${base}/porta-un-amico`, changeFrequency: "monthly", priority: 0.6, lastModified: new Date("2026-10-06") },
  ];
}
