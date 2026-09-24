import { redirect } from "next/navigation";

/** I lead del funnel non sono più un elenco a parte in sola lettura: ogni notte
 *  vengono importati in `leads` e vivono in /admin/contatti come tutti gli
 *  altri, con stato, conversione ed eliminazione. */
export default async function ListaAttesaRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const qs = new URLSearchParams({ fonte: "funnel" });
  if (q) qs.set("q", q);
  redirect(`/admin/contatti?${qs}`);
}
