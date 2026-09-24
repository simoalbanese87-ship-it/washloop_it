import { redirect } from "next/navigation";

/** "Fatture" era il nome sbagliato: nel regime scelto la fattura è
 *  l'eccezione e quasi tutti gli incassi hanno solo la ricevuta. La sezione si
 *  chiama Incassi; questo indirizzo resta valido. */
export default async function FattureRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) qs.set(k, v);
  redirect(`/admin/incassi${qs.toString() ? `?${qs}` : ""}`);
}
