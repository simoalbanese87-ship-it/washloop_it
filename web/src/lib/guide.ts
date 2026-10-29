/** L'elenco delle guide, in un posto solo.
 *
 *  Tre cose lo leggono: la pagina indice, la sitemap e i rimandi in fondo agli
 *  articoli. Se vivesse dentro la pagina indice, pubblicare una guida
 *  significherebbe ricordarsi di aggiungerla anche alla sitemap — e la sitemap
 *  è la cosa che nessuno si ricorda, perché non si vede.
 *
 *  L'ordine è quello in cui compaiono: la più utile per prima, non la più
 *  recente. Sono quattro, non quaranta: un indice che si legge tutto. */
export type Guida = {
  slug: string;
  titolo: string;
  sommario: string;
  /** Data dell'ultima revisione, in formato ISO per la sitemap. */
  aggiornata: string;
};

export const GUIDE: Guida[] = [
  {
    slug: "quanto-costa-lavanderia-a-domicilio-milano",
    titolo: "Quanto costa la lavanderia a domicilio a Milano",
    sommario:
      "Rilevazione su 13 lavanderie milanesi, con la fonte di ogni prezzo: camicia da 2,40 a 4,00 €, piumone da 15 a 25 €, e 4 operatori su 11 che non dicono quanto costa il ritiro.",
    aggiornata: "2026-10-29",
  },
  {
    slug: "come-lavare-un-piumone",
    titolo: "Come lavare un piumone in lavatrice (e quando non farlo)",
    sommario:
      "Quanti kg serve la lavatrice, a che temperatura, perché l'ammorbidente rovina la piuma e come capire quando è asciutto davvero.",
    aggiornata: "2026-10-29",
  },
  {
    slug: "come-stirare-una-camicia",
    titolo: "Come stirare una camicia: l'ordine giusto in 5 minuti",
    sommario:
      "Colletto, polsini, maniche, carré, davanti, dietro. L'ordine conta più del ferro, e le temperature cambiano per tessuto.",
    aggiornata: "2026-10-29",
  },
];

export const urlGuida = (slug: string) => `https://washloop.it/guide/${slug}`;
