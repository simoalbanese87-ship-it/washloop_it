/** Il nome della lavanderia come si dice a voce.
 *
 *  Sul telefono del rider la ragione sociale occupa due righe — «Centro
 *  Pulitura Bergamo di Narisi Giuseppe & C. Snc» — e su cinque fermate di
 *  seguito è sempre la stessa: tanto lunga da coprire tutto il resto e tanto
 *  uguale da non distinguere niente. Il rider chiama quel posto «Bergamo» e
 *  l'altro «Susanna».
 *
 *  Si taglia dove finisce il nome e comincia l'anagrafe dell'impresa: la forma
 *  societaria, il «di» del titolare, la e commerciale. Quello che resta è un
 *  nome che si legge di sfuggita, e il nome intero continua a esistere dove
 *  serve davvero — sul proforma, nel pannello, sui documenti.
 *
 *  Funzione pura e conservativa: se non riconosce niente da tagliare restituisce
 *  il nome com'è. Un nome accorciato male è peggio di un nome lungo. */

/** Le forme societarie, scritte come capita di trovarle. Il punto può esserci o
 *  no, le maiuscole pure: il confronto si fa su una versione normalizzata. */
const FORME = [
  "s.n.c", "snc",
  "s.r.l.s", "srls",
  "s.r.l", "srl",
  "s.p.a", "spa",
  "s.a.s", "sas",
  "s.s", "ss",
  "& c", "e c",
];

/** Taglia il nome al primo segno che quello che segue non è più il nome. */
export function nomeBreveLavanderia(nome: string | null | undefined): string {
  const intero = (nome ?? "").trim();
  if (!intero) return "";

  // Si lavora su una copia senza accenti di maiuscolo, per confrontare, ma si
  // taglia sempre l'originale: il risultato deve restare scritto com'era.
  const basso = intero.toLowerCase();

  let taglio = intero.length;
  const prima = (indice: number) => {
    if (indice > 0 && indice < taglio) taglio = indice;
  };

  // « di Mario Rossi»: da lì in poi c'è il titolare, non l'insegna.
  prima(basso.indexOf(" di "));

  for (const forma of FORME) {
    // Preceduta da spazio e seguita da fine, spazio o punteggiatura: così
    // «Snc» non taglia dentro una parola e «Lavanderia Sassi» resta intera.
    const re = new RegExp(`\\s${forma.replace(/[.&]/g, "\\$&")}(?=$|[\\s.,;])`, "i");
    const m = re.exec(intero);
    if (m) prima(m.index);
  }

  const breve = intero.slice(0, taglio).replace(/[\s,.&-]+$/, "").trim();
  // Un taglio che lascia una parola sola di due lettere ha tagliato troppo.
  return breve.length >= 3 ? breve : intero;
}
