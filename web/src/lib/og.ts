/** L'immagine di anteprima, da ripetere su ogni pagina che si scrive il
 *  proprio `openGraph`.
 *
 *  Next aggiunge da sé l'immagine di `opengraph-image.tsx` **solo** alle pagine
 *  che non dichiarano un blocco `openGraph` loro: dove c'è, sostituisce quello
 *  del layout per intero, immagine compresa. È così che il 29 ottobre 2026 il
 *  sito si è trovato con `twitter:image` su tutte le pagine (nessuna dichiara
 *  `twitter`) e `og:image` su nessuna delle cinque principali.
 *
 *  L'indirizzo è quello della rotta generata, senza l'impronta che Next
 *  aggiunge per la cache: funziona lo stesso ed è un URL che si può leggere. */
export const OG_IMMAGINE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "WashLoop — lavanderia a domicilio in abbonamento a Milano",
} as const;
