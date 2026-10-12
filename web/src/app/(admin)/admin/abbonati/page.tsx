import { redirect } from "next/navigation";

/** L'elenco degli abbonati non esiste più come pagina a sé.
 *
 *  Erano due liste sullo stesso mondo: qui i clienti, in Persone i clienti **e**
 *  i lead, uniti per email o telefono. Due liste vogliono dire due colonne
 *  «stato» da tenere d'accordo, due filtri, due conteggi — e infatti dicevano
 *  numeri diversi. Peggio: le note del telefono si vedevano solo in Persone,
 *  così chi apriva Abbonati non sapeva cosa ci si era detti.
 *
 *  Resta l'indirizzo, perché è nei segnalibri e in parecchi link: porta alla
 *  stessa domanda, fatta all'unica lista rimasta. Le schede cliente
 *  (`/admin/abbonati/[id]`) non si toccano: quelle sono il posto giusto. */
export default function AbbonatiPage() {
  redirect("/admin/persone?stadio=attivo");
}
