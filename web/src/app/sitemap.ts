import type { MetadataRoute } from "next";

/** Le pagine che vogliamo in un motore di ricerca.
 *
 *  Erano due — la home e, senza motivo, `/login` — e il risultato si è visto:
 *  cercando "washloop" Google metteva l'Informativa Privacy sotto la home,
 *  perché fra quello che aveva era l'unica altra pagina con del testo. Non
 *  sceglieva male: sceglieva fra poco.
 *
 *  Le legali sono uscite dall'indice (restano nel piè di pagina) e al loro
 *  posto ci sono due pagine che quel posto se lo meritano, una per ciascuna
 *  domanda che la gente digita davvero. `/disponibilita` resta fuori ed è
 *  voluto: serve alle campagne a pagamento e non deve competere in organico. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://washloop.it";
  const aggiornato = new Date("2026-09-24");
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1, lastModified: aggiornato },
    { url: `${base}/lavanderia-a-domicilio-milano`, changeFrequency: "monthly", priority: 0.9, lastModified: aggiornato },
    { url: `${base}/servizio-stiro-a-domicilio-milano`, changeFrequency: "monthly", priority: 0.9, lastModified: aggiornato },
    // I prezzi cambiano più spesso delle due pagine di servizio, e la pagina li
    // legge dal database: quando cambiano in pannello, cambia anche qui.
    { url: `${base}/prezzi`, changeFrequency: "weekly", priority: 0.9, lastModified: aggiornato },
  ];
}
