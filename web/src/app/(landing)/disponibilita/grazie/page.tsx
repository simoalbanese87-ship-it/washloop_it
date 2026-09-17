import { redirect } from "next/navigation";

/** La pagina di ringraziamento è una sola, e ora sta su `/grazie`.
 *
 *  Ci arrivano due form — quello della home e quello della landing pubblicitaria
 *  — e tenerla sotto `/disponibilita` significava mandare chi viene dalla home
 *  su un indirizzo che parla di un'altra pagina. Questo indirizzo resta valido:
 *  è finito nelle conversioni di Google Ads, e cambiarlo senza redirect
 *  spezzerebbe il tracciamento delle campagne già attive. */
export default async function GrazieRedirect({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  redirect(`/grazie${c ? `?c=${c === "1" ? "1" : "0"}` : ""}`);
}
