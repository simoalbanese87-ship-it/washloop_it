import { redirect } from "next/navigation";

/** Le richieste dalla landing ora vivono in /admin/contatti, insieme a quelle
 *  del funnel: la stessa persona compariva in quattro pagine diverse.
 *  L'indirizzo resta valido e porta alla lista filtrata sulla provenienza,
 *  conservando i filtri già in uso. */
export default async function DisponibilitaRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ fonte: "landing" });
  for (const k of ["q", "zona", "stato"]) {
    const v = sp[k];
    if (typeof v === "string" && v) qs.set(k, v);
  }
  redirect(`/admin/contatti?${qs}`);
}
