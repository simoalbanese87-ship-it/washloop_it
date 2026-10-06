import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";

/** «Porta un amico», lato pubblico.
 *
 *  `/invita/[codice]` è la pagina di chi ha già ricevuto un link: parla di una
 *  persona precisa e non va indicizzata. Questa è l'altra metà — la regola
 *  raccontata a chi non ha ancora nessun link in mano: un cliente che vuole
 *  capire quanto vale prima di mandarla in giro, o qualcuno che la trova dal
 *  sito. È statica e non interroga nulla: non c'è niente di personale sopra.
 *
 *  Le regole stanno scritte per intero, soprattutto quelle che tolgono: vale
 *  sul primo acquisto dell'amico e non sui rinnovi. Scoprirlo dopo, da un
 *  premio che non arriva, costa molto più che leggerlo adesso. */

export const metadata: Metadata = {
  title: "Porta un amico — una settimana di WashLoop in regalo",
  description:
    "Mandi il tuo link, il tuo amico attiva un abbonamento WashLoop e a te regaliamo una settimana, scalata dalla prossima fattura. Nessun limite al numero di amici.",
  alternates: { canonical: "/porta-un-amico" },
};

const PASSI = [
  {
    t: "Mandi il tuo link",
    d: "Lo trovi nella tua area, alla voce «Porta un amico»: è il tuo codice WL-, lo stesso stampato sull'etichetta del sacco. Si copia o si manda su WhatsApp con un tocco.",
  },
  {
    t: "Il tuo amico attiva un abbonamento",
    d: "Apre il link, sceglie il piano e il giorno del ritiro. Da quel momento è un cliente come gli altri: stesso prezzo di listino, nessuna condizione diversa.",
  },
  {
    t: "La tua settimana arriva da sola",
    d: "Ti accreditiamo una settimana del tuo piano come credito: si scala in automatico dalla tua prossima fattura. Non devi chiedere niente a nessuno.",
  },
];

const REGOLE = [
  "Il regalo scatta sul **primo acquisto** del tuo amico, non sui rinnovi successivi.",
  "Vale **qualsiasi piano a listino**: Small, Medium o Large.",
  "**Nessun limite**: porti tre amici, ricevi tre settimane.",
  "La settimana è calcolata sul **tuo** piano, non sul suo: su uno Small vale 40 €.",
  "Il credito resta sul tuo account e si consuma alla prima fattura utile.",
];

/** Il grassetto nelle regole è scritto con gli asterischi per tenere le frasi
 *  leggibili qui sopra; qui si trasforma, senza HTML buttato dentro a mano. */
function conGrassetto(testo: string) {
  return testo.split(/\*\*(.+?)\*\*/g).map((pezzo, i) =>
    i % 2 === 1 ? <strong key={i} className="text-navy">{pezzo}</strong> : <span key={i}>{pezzo}</span>,
  );
}

export default function PortaUnAmico() {
  return (
    <>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">Porta un amico</div>
          <h1 className="mt-3 font-display text-[32px] font-black leading-[1.08] tracking-[-0.02em] sm:text-5xl">
            Una settimana in regalo, per ogni amico che porti<span className="text-cyan">.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-white/70">
            Mandi il tuo link a chi vuoi. Quando un amico attiva un abbonamento WashLoop, a te regaliamo una
            settimana del tuo piano: la scaliamo in automatico dalla tua prossima fattura.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/app/invita" size="lg">
              Sono già cliente: il mio link →
            </ButtonLink>
            <Link href="/onboarding" className="font-display text-sm font-bold text-cyan hover:underline">
              Non sono ancora cliente: attiva WashLoop
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-16">
          <h2 className="font-display text-2xl font-black tracking-[-0.02em] text-navy sm:text-3xl">Come funziona</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {PASSI.map((p, i) => (
              <li key={p.t}>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan/15 font-display text-base font-black text-blue">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-lg font-extrabold text-navy">{p.t}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{p.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-ice">
        <div className="mx-auto max-w-4xl px-5 py-16">
          <h2 className="font-display text-2xl font-black tracking-[-0.02em] text-navy sm:text-3xl">Le regole, tutte</h2>
          <ul className="mt-6 space-y-3">
            {REGOLE.map((r) => (
              <li key={r} className="flex gap-3 text-sm font-medium leading-relaxed text-muted">
                <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-cyan" />
                <span>{conGrassetto(r)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm font-medium leading-relaxed text-muted">
            Il tuo amico paga il prezzo di listino: il regalo è tuo, e non gli togliamo niente per fartelo.
            Se qualcosa non torna, scrivici a{" "}
            <a href="mailto:info@washloop.it" className="font-bold text-blue hover:underline">info@washloop.it</a>{" "}
            e lo guardiamo insieme.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center">
          <h2 className="font-display text-2xl font-black tracking-[-0.02em] text-navy sm:text-3xl">
            Il tuo link ti aspetta nella tua area
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-relaxed text-muted">
            Entra, copialo e mandalo. Gli amici che hai portato, e quanto ti hanno fatto risparmiare, li trovi
            nella stessa pagina.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/app/invita" size="lg">Vai al mio link →</ButtonLink>
            <Link href="/prezzi" className="font-display text-sm font-bold text-blue hover:underline">
              Guarda i piani
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
