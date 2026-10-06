import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizzaCodice } from "@/lib/invito";

export const dynamic = "force-dynamic";

/** La pagina che vede l'amico invitato.
 *
 *  Non è la home con un parametro in più: chi arriva da qui ci arriva perché
 *  qualcuno che conosce gli ha detto che funziona, e la prima riga deve dirgli
 *  chi è stato. È la differenza fra una pubblicità e una raccomandazione, ed è
 *  l'unica cosa che questo canale ha in più di tutti gli altri.
 *
 *  Un codice che non esiste non è un errore della persona che ha cliccato: si
 *  manda all'iscrizione normale, senza spiegazioni e senza schermate rosse. */

/** Solo il nome, mai il cognome: il link può finire in una chat di gruppo, e
 *  chi invita non ha acconsentito a farsi pubblicare il cognome da estranei. */
function soloNome(full: string | null): string | null {
  const n = (full ?? "").trim().split(/\s+/)[0];
  return n || null;
}

export async function generateMetadata({ params }: { params: Promise<{ codice: string }> }): Promise<Metadata> {
  const { codice } = await params;
  const c = normalizzaCodice(codice);
  if (!c) return { title: "Attiva WashLoop" };
  return {
    title: "Un amico ti ha invitato su WashLoop",
    description: "Ritiro a domicilio, lavaggio e stiratura, riconsegna entro 3 giorni feriali. Attiva il tuo abbonamento.",
    robots: { index: false, follow: false },
  };
}

export default async function InvitoPage({ params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params;
  const c = normalizzaCodice(codice);
  if (!c) redirect("/onboarding");

  const svc = createServiceClient();
  const { data: invitante } = await svc
    .from("profiles")
    .select("full_name, role")
    .eq("client_code", c)
    .maybeSingle<{ full_name: string | null; role: string }>();

  if (!invitante || invitante.role !== "customer") redirect("/onboarding");

  const nome = soloNome(invitante.full_name);
  const vai = `/onboarding?ref=${c}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
      <div className="rounded-[26px] border border-line bg-white p-7 shadow-[0_24px_60px_-40px_rgba(27,45,94,0.45)] sm:p-10">
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Ti hanno invitato</div>
        <h1 className="mt-2 font-display text-[30px] font-black leading-[1.1] tracking-[-0.02em] text-navy sm:text-[40px]">
          {nome ? `${nome} ti ha invitato` : "Un amico ti ha invitato"} su WashLoop.
        </h1>
        <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-muted">
          Il bucato lo ritiriamo sotto casa nel giorno che scegli, lo laviamo e lo stiriamo, e te lo riportiamo
          entro tre giorni feriali. Tutto compreso in un abbonamento mensile: ritiro e consegna non si pagano a parte.
        </p>

        <ol className="mt-7 space-y-3">
          {[
            "Scegli il piano e il giorno fisso del ritiro.",
            "Metti il bucato nel sacco e lascialo sotto casa: lo ritira il rider.",
            "Te lo riportiamo lavato e stirato, pronto per l'armadio.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-blue/10 font-display text-sm font-black text-blue">
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm font-medium text-navy">{t}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink href={vai} size="lg">
            Attiva WashLoop →
          </ButtonLink>
          <a href="/prezzi" className="font-display text-sm font-bold text-blue hover:underline">
            Prima guarda i prezzi
          </a>
        </div>

        <p className="mt-6 text-xs font-medium text-muted">
          Serviamo Milano città e Rozzano, Assago e Buccinasco. Nel primo passo ti chiediamo il CAP: se non siamo
          ancora da te, te lo diciamo subito.
        </p>
      </div>
    </div>
  );
}
