import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { JsonLd } from "@/components/marketing/JsonLd";
import { attivitaJsonLd } from "@/lib/area-servita";

/** L'impaginazione di una guida.
 *
 *  Perché il sito ne ha bisogno
 *  ----------------------------
 *  Fino a oggi washloop.it aveva sei pagine, tutte commerciali. Non esisteva un
 *  posto dove un contenuto potesse vivere senza vendere niente — e quindi non
 *  esisteva niente che qualcuno potesse avere voglia di linkare. Le guide sono
 *  quel posto.
 *
 *  Tre scelte che contano più della grafica:
 *
 *  1. **La data si vede.** Un consiglio sul lavaggio senza data potrebbe essere
 *     del 2014. Dirla è un segnale di affidabilità e costa una riga.
 *  2. **La firma dice chi parla.** Oggi è l'azienda; il giorno che una guida la
 *     firma una persona con nome e ruolo, vale di più — ed è il passo che manca
 *     (sta nel cantiere SEO, voce «Chi siamo»).
 *  3. **Il richiamo commerciale sta in fondo, ed è onesto.** Una guida che
 *     spiega come lavare un piumone in casa e poi dice «comunque fallo fare a
 *     noi» ogni due righe non la linka nessuno. */

export type DatiGuida = {
  titolo: string;
  sottotitolo: string;
  /** Quando è stata scritta o rivista, in parole: «29 ottobre 2026». */
  aggiornata: string;
  /** Lettura in minuti, onesta. */
  minuti: number;
  /** L'indirizzo completo, per i dati strutturati. */
  url: string;
  /** Il richiamo in fondo, diverso per ogni guida: deve parlare di quello di
   *  cui parla la guida, non del servizio in generale. */
  chiusura: { titolo: string; testo: string; cta: { href: string; testo: string } };
};

export function Guida({ dati, children }: { dati: DatiGuida; children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            attivitaJsonLd(),
            {
              "@type": "Article",
              headline: dati.titolo,
              description: dati.sottotitolo,
              url: dati.url,
              inLanguage: "it-IT",
              // `publisher` e `author` puntano all'azienda: è la verità di
              // oggi. Mettere un nome di persona che non compare in nessuna
              // pagina sarebbe un dato strutturato che non si può verificare.
              author: { "@id": "https://washloop.it/#attivita" },
              publisher: { "@id": "https://washloop.it/#attivita" },
            },
          ],
        }}
      />

      <article className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-16 md:py-20">
          <Link href="/guide" className="font-display text-xs font-extrabold uppercase tracking-[0.2em] text-blue hover:underline">
            ← Guide
          </Link>
          <h1 className="mt-5 font-display text-4xl font-black leading-[1.08] tracking-[-0.03em] text-navy md:text-5xl">
            {dati.titolo}
          </h1>
          <p className="mt-5 text-lg font-medium leading-relaxed text-muted">{dati.sottotitolo}</p>
          <p className="mt-6 border-t border-line pt-4 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            WashLoop · Milano · aggiornata il {dati.aggiornata} · {dati.minuti} min di lettura
          </p>

          {/* Il corpo. Gli stili dei titoli e dei paragrafi stanno qui una volta
              sola, così una guida nuova è solo testo. */}
          <div className="mt-10 space-y-5 text-base font-medium leading-relaxed text-navy/80 [&_a]:font-bold [&_a]:text-blue [&_a]:underline [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-[-0.02em] [&_h2]:text-navy [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:text-navy [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ol>li]:list-decimal [&_strong]:font-extrabold [&_strong]:text-navy [&_table]:w-full [&_td]:border-t [&_td]:border-line [&_td]:py-2 [&_td]:pr-4 [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-display [&_th]:text-sm [&_th]:font-extrabold [&_th]:text-navy [&_ul]:space-y-2">
            {children}
          </div>
        </div>
      </article>

      <section className="bg-ice">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="font-display text-2xl font-black tracking-[-0.02em] text-navy md:text-3xl">
            {dati.chiusura.titolo}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-relaxed text-muted">{dati.chiusura.testo}</p>
          <div className="mt-7">
            <ButtonLink href={dati.chiusura.cta.href}>{dati.chiusura.cta.testo} →</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
