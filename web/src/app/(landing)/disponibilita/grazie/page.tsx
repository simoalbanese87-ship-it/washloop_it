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
  searchParams: Promise<{ c?: string; ok?: string }>;
}) {
  const { c, ok } = await searchParams;
  // Il gettone va portato avanti, o chi passa di qui non verrebbe contato.
  const q = new URLSearchParams();
  if (c) q.set("c", c === "1" ? "1" : "0");
  if (ok && /^[a-f0-9]{1,32}$/.test(ok)) q.set("ok", ok);
  redirect(`/grazie${q.toString() ? `?${q}` : ""}`);
}
