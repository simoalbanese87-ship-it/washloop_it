import { redirect } from "next/navigation";

/** L'archivio è diventato un filtro degli ordini: "consegnati" compariva sia
 *  qui sia nel board, e per cercare un ordine bisognava indovinare in quale
 *  delle due pagine fosse finito. */
export default function ArchivioRedirect() {
  redirect("/admin/ordini?stato=conclusi");
}
