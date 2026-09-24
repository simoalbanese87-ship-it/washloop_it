import { redirect } from "next/navigation";

/** I contatti non sono più una lista a parte: lead e clienti vivono in
 *  /admin/persone, distinti dallo stadio. La domanda «qui vedo solo i lead o
 *  anche i clienti?» non ha più motivo di esistere.
 *
 *  Questo reindirizzamento teneva solo `q` e buttava via tutto il resto, quindi
 *  ogni link che ci passava attraverso perdeva il proprio filtro per strada:
 *  «Da contattare» sulla home apriva l'elenco completo, «Novità» ignorava i
 *  sette giorni. Ora i parametri conosciuti si trasferiscono. */
const TRADUZIONE: Record<string, string> = {
  // `stato` era il nome vecchio dello stato del contatto.
  stato: "contatto",
  contatto: "contatto",
  q: "q",
  prova: "prova",
};

export default async function ContattiRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ stadio: "lead" });
  for (const [chiave, destinazione] of Object.entries(TRADUZIONE)) {
    const v = sp[chiave];
    const valore = Array.isArray(v) ? v[0] : v;
    if (valore) qs.set(destinazione, valore);
  }
  redirect(`/admin/persone?${qs}`);
}
