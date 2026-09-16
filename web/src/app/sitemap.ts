import type { MetadataRoute } from "next";

/** Le pagine che vogliamo in un motore di ricerca.
 *
 *  Ce n'è una, ed è giusto che si veda: la home è l'unica pagina pubblica che
 *  racconta il servizio. Le legali sono uscite dall'indice (restano nel piè di
 *  pagina), la landing `/disponibilita` è `noindex` di proposito — serve alle
 *  campagne a pagamento e non deve competere con la home in organico.
 *
 *  `/login` stava qui e non doveva: è la porta dell'area riservata, non una
 *  pagina di arrivo. Metterla in sitemap è dire a Google «indicizza anche
 *  questa», e con così poche pagine fra cui scegliere diventa candidata a
 *  comparire sotto la home nei risultati — che è esattamente il problema da cui
 *  si esce. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://washloop.it";
  return [{ url: `${base}/`, changeFrequency: "weekly", priority: 1 }];
}
