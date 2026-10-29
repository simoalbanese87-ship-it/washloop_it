/** La stessa immagine, per chi legge la card di X/Twitter.
 *
 *  Next non riusa da solo l'immagine Open Graph per Twitter: se questo file non
 *  esiste, `twitter:image` resta vuoto. Invece di disegnarne un'altra, qui si
 *  riesporta quella — una sola immagine da aggiornare, non due che col tempo
 *  dicono cose diverse. */
export { default, alt, size, contentType } from "./opengraph-image";
