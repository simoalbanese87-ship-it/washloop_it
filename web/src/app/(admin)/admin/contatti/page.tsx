import { redirect } from "next/navigation";

/** I contatti non sono più una lista a parte: lead e clienti vivono in
 *  /admin/persone, distinti dallo stadio. La domanda «qui vedo solo i lead o
 *  anche i clienti?» non ha più motivo di esistere. */
export default async function ContattiRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const qs = new URLSearchParams({ stadio: "lead" });
  if (q) qs.set("q", q);
  redirect(`/admin/persone?${qs}`);
}
