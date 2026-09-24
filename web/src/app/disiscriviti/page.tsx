import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { disiscriviConToken } from "@/lib/actions/unsubscribe";

export const metadata: Metadata = {
  title: "Disiscrizione",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Pagina di disiscrizione dalle email non di servizio.
 *
 *  Il clic sul link NON disiscrive da solo: mostra un pulsante. È voluto —
 *  antispam e client di posta aprono in anticipo i link delle email per
 *  controllarli, e una disiscrizione in GET verrebbe eseguita da un antivirus
 *  al posto della persona. La disiscrizione avviene solo con la POST del form.
 *
 *  Resta scritto in chiaro che gli avvisi sul proprio ordine continuano ad
 *  arrivare: sono servizio, non pubblicità, e chi ha un ritiro prenotato deve
 *  sapere quando passiamo. */
export default async function DisiscrivitiPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; fatto?: string }>;
}) {
  const { t, fatto } = await searchParams;

  async function conferma(formData: FormData) {
    "use server";
    const token = String(formData.get("t") ?? "");
    const esito = await disiscriviConToken(token);
    redirect(esito.ok ? "/disiscriviti?fatto=1" : "/disiscriviti?fatto=0");
  }

  const done = fatto === "1";
  const failed = fatto === "0";

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-5 py-16 text-center text-white">
      <div className="max-w-md">
        <Logo variant="white" size={30} className="mx-auto" />

        {done ? (
          <>
            <h1 className="mt-10 font-display text-3xl font-black tracking-[-0.02em]">Fatto</h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-white/65">
              Non ti manderemo più email informative. Se hai un ritiro prenotato o un abbonamento attivo,
              gli avvisi sul tuo ordine continuano ad arrivare: servono a farti sapere quando passiamo.
            </p>
          </>
        ) : failed ? (
          <>
            <h1 className="mt-10 font-display text-3xl font-black tracking-[-0.02em]">Link non valido</h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-white/65">
              Questo link di disiscrizione non è più valido. Scrivi a{" "}
              <a href="mailto:info@washloop.it" className="font-bold text-cyan underline">info@washloop.it</a> e ci
              pensiamo noi.
            </p>
          </>
        ) : !t ? (
          <>
            <h1 className="mt-10 font-display text-3xl font-black tracking-[-0.02em]">Link incompleto</h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-white/65">
              Apri il link direttamente dall&apos;email che hai ricevuto, oppure scrivi a{" "}
              <a href="mailto:info@washloop.it" className="font-bold text-cyan underline">info@washloop.it</a>.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-10 font-display text-3xl font-black tracking-[-0.02em]">Vuoi disiscriverti?</h1>
            <p className="mt-3 text-base font-medium leading-relaxed text-white/65">
              Smetteremo di mandarti email informative su WashLoop. Gli avvisi legati a un tuo ordine
              — ritiro, riconsegna, ricevute — continueranno ad arrivare.
            </p>
            <form action={conferma} className="mt-8">
              <input type="hidden" name="t" value={t} />
              <button
                type="submit"
                className="inline-flex min-h-[52px] items-center justify-center rounded-[40px] bg-white px-7 font-display text-base font-extrabold text-navy"
              >
                Confermo, disiscrivimi
              </button>
            </form>
            <Link href="/" className="mt-6 inline-block text-sm font-semibold text-white/45 underline">
              No, ho cambiato idea
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
