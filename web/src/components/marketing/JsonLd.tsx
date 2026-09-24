/** Dati strutturati, nel modo che Google legge davvero.
 *
 *  Il titolo e la descrizione dicono a un motore di ricerca *come si chiama*
 *  una pagina. Questi gli dicono **cos'è**: che WashLoop è un'attività locale
 *  con un indirizzo a Milano, che quello descritto è un servizio con un'area
 *  servita e un prezzo, che quelle in fondo sono domande e risposte. È la
 *  differenza fra comparire e comparire con le domande già aperte nel
 *  risultato.
 *
 *  `dangerouslySetInnerHTML` è l'unico modo di emettere un blocco JSON-LD in
 *  React, e qui è sicuro perché l'oggetto lo costruiamo noi: `JSON.stringify`
 *  di dati nostri, mai di qualcosa che arrivi da fuori. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // `</script>` dentro una stringa chiuderebbe il tag in anticipo: la barra
      // si sfugge, ed è la sola cosa che può rompere un blocco JSON-LD.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
