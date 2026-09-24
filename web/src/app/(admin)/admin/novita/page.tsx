import { redirect } from "next/navigation";

/** "Novità" era la stessa lista di contatti filtrata per data: è diventata il
 *  filtro «ultimi 7 giorni» dentro /admin/contatti. Il riepilogo dei nuovi
 *  clienti resta nella Home. */
export default function NovitaRedirect() {
  redirect("/admin/contatti?nuovi=7g");
}
