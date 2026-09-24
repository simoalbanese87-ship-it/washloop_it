import { redirect } from "next/navigation";

/** «Fatture» era il nome sbagliato anche qui: la fattura la emettiamo noi da
 *  Fatture in Cloud e solo su richiesta, mentre ogni pagamento ha la sua
 *  ricevuta. L'indirizzo resta valido — sta nei preferiti di qualcuno. */
export default function FattureRedirect() {
  redirect("/app/ricevute");
}
