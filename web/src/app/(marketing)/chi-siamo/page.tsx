import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Bubbles } from "@/components/marketing/Bubbles";
import { JsonLd } from "@/components/marketing/JsonLd";
import { graficoPagina, fondatoreJsonLd } from "@/lib/area-servita";
import { LEGAL } from "@/lib/legal";
import { OG_IMMAGINE } from "@/lib/og";

/* ============================================================
   Chi siamo

   Perché esisteva un buco
   -----------------------
   Era un 404. Su un servizio a cui si consegnano i vestiti di casa, «chi
   siete» è la domanda che si fa chiunque prima di lasciare un sacco sul
   pianerottolo — e la risposta non c'era da nessuna parte: non un nome, non
   una faccia, non un'azienda con una partita IVA leggibile senza scendere
   nelle condizioni di vendita.

   Cosa c'è dentro, e perché solo questo
   -------------------------------------
   Solo cose verificabili. La società con i suoi dati veri, chi la guida, e
   come è fatta la catena che tocca i capi. Niente storia di fondazione
   inventata e nessun numero che non si possa controllare: su una pagina che
   serve a farsi credere, una frase gonfiata costa più di quanto renda.

   I laboratori partner non sono nominati di proposito: uno dei due è
   intestato a una persona fisica, e pubblicarne nome e indirizzo è una
   decisione sua, non nostra.
   ============================================================ */

const URL_PAGINA = "https://washloop.it/chi-siamo";

export const metadata: Metadata = {
  title: "Chi siamo",
  description:
    "Chi c'è dietro WashLoop, la lavanderia a domicilio in abbonamento a Milano: la società, chi la guida e dove finiscono davvero i capi che ritiriamo.",
  alternates: { canonical: "/chi-siamo" },
  openGraph: {
    title: "Chi siamo — WashLoop",
    description: "La società, chi la guida e dove finiscono i capi che ritiriamo. Senza giri di parole.",
    url: URL_PAGINA,
    type: "website",
    locale: "it_IT",
    images: [OG_IMMAGINE],
  },
};

const FAQ_PAGINA = [
  {
    q: "Chi c'è dietro WashLoop?",
    a: "WashLoop è un servizio di Digital Consulting S.r.l., società con sede a Milano in Via Franco Russoli 9, partita IVA 09682420964. È guidata da Simone Albanese, che risponde anche al telefono quando serve.",
  },
  {
    q: "Dove vengono lavati i capi?",
    a: "In laboratori professionali, attrezzati per lavorare volumi veri. Ogni sacco viaggia con il suo codice e in ogni momento sappiamo dove si trova e in che fase è.",
  },
  {
    q: "Avete un negozio?",
    a: "No, e non è una mancanza: WashLoop esiste solo a domicilio. Via Franco Russoli 9 è la sede legale della società, non un punto di accettazione: lì non si consegnano capi.",
  },
  {
    q: "Quante persone siete?",
    a: "Pochissime, e si vede: rispondiamo in giornata nei feriali e più lentamente nel fine settimana. Il lavaggio lo fanno i laboratori partner, il ritiro e la riconsegna li facciamo noi con i nostri rider.",
  },
];

const PRINCIPI = [
  {
    t: "Il prezzo si legge prima",
    d: "Il listino dei capi fuori abbonamento è pubblicato per intero, voce per voce, su una pagina che chiunque può aprire senza registrarsi. Non è coraggio: è che un prezzo che si scopre alla fine è il motivo per cui la gente non si fida delle lavanderie.",
    href: "/prezzi",
    link: "Guarda il listino",
  },
  {
    t: "Un giorno fisso, non «quando capita»",
    d: "Il ritiro cade sempre nello stesso giorno della settimana. Serve a farlo diventare una cosa che non devi ricordare — e serve a noi, perché un giro che si ripete è un giro che si può fare bene.",
    href: "/come-funziona",
    link: "Come funziona",
  },
  {
    t: "Il trasporto è dentro",
    d: "Ritiro e riconsegna sono compresi, anche nei comuni dell'hinterland che serviamo. Non c'è una soglia da raggiungere e non c'è un supplemento di zona: il viaggio è il servizio, farlo pagare a parte sarebbe un modo per far sembrare basso un prezzo che non lo è.",
    href: "/lavanderia-a-domicilio-milano",
    link: "Dove passiamo",
  },
];

/** Il grafo della pagina: quello standard, più il fondatore descritto.
 *
 *  Il fondatore si dichiara qui e solo qui — le altre pagine lo citano con il
 *  suo `@id` — così nel grafo del sito resta una persona sola invece di una
 *  copia per pagina. */
const base = graficoPagina({
  nomeServizio: "Lavanderia a domicilio a Milano",
  descrizione:
    "Chi c'è dietro WashLoop, lavanderia a domicilio in abbonamento a Milano: la società, chi la guida e i laboratori che lavorano i capi.",
  url: URL_PAGINA,
  faq: FAQ_PAGINA,
});
const grafo = { ...base, "@graph": [...base["@graph"], fondatoreJsonLd()] };

export default function ChiSiamoPage() {
  return (
    <>
      <JsonLd data={grafo} />

      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto max-w-4xl px-5 py-16 md:py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">Chi siamo</div>
          <h1 className="mt-4 font-display text-4xl font-black leading-[1.05] tracking-[-0.03em] md:text-5xl">
            Lasci i vestiti a qualcuno. <span className="text-cyan">Vale la pena sapere a chi.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/65">
            WashLoop ritira il bucato sotto casa a Milano, lo fa lavare e stirare in laboratori
            professionali e lo riporta piegato. Dietro c&apos;è una società vera, con una partita
            IVA e un indirizzo, e una squadra piccola abbastanza da rispondere di persona.
          </p>
        </div>
      </section>

      {/* Chi guida */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="rounded-[28px] border border-line bg-ice p-8 md:p-10">
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">
              Chi guida WashLoop
            </div>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy">Simone Albanese</h2>
            <p className="mt-2 font-display text-sm font-bold text-blue">Fondatore</p>
            <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-muted">
              Se chiami il numero qui sotto, dall&apos;altra parte c&apos;è lui o qualcuno che siede
              alla stessa scrivania. Non c&apos;è un centralino e non c&apos;è un modulo che finisce
              in una casella che nessuno apre: su un servizio che entra in casa, sapere con chi si
              parla conta più di qualsiasi promessa.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href={`tel:${LEGAL.phone.replace(/\s/g, "")}`}>{LEGAL.phone}</ButtonLink>
              <ButtonLink href="/contatti" variant="ghost">
                Tutti i recapiti →
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Come la pensiamo, dimostrato */}
      <section className="bg-ice">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Come la pensiamo</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Tre scelte, e si vedono tutte.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-muted">
            Non sono valori scritti su una parete: sono decisioni che hanno un prezzo, e ognuna ha
            una pagina dove puoi verificarla adesso.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PRINCIPI.map((p) => (
              <div key={p.t} className="flex flex-col rounded-[24px] border border-line bg-white p-7">
                <h3 className="font-display text-lg font-extrabold leading-snug text-navy">{p.t}</h3>
                <p className="mt-3 flex-1 text-sm font-medium leading-relaxed text-muted">{p.d}</p>
                <Link href={p.href} className="mt-5 font-display text-sm font-bold text-blue hover:underline">
                  {p.link} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* La catena vera */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">
            Dove finiscono i capi
          </div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Non li laviamo noi, e lo diciamo.
          </h2>
          {/* Dei laboratori non si dice **niente**: non il nome, non la città,
              non la provincia. Una geografia è una traccia che un concorrente
              segue in dieci minuti, e quei rapporti restano nostri. Quello che
              il cliente ha diritto di sapere è un'altra cosa: che il lavoro lo
              fa un professionista, e che il suo sacco non si perde di vista un
              momento. */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-line bg-ice p-7">
              <h3 className="font-display text-lg font-extrabold text-navy">Chi li lavora</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted">
                <strong className="text-navy">Laboratori professionali</strong>, attrezzati per volumi veri e con
                macchinari da lavanderia: è il mestiere di qualcuno che lo fa tutto il giorno.
              </p>
            </div>
            <div className="rounded-[24px] border border-line bg-ice p-7">
              <h3 className="font-display text-lg font-extrabold text-navy">Due lavori diversi</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted">
                Lavare e stirare non sono lo stesso mestiere: chi ci manda solo camicie da stirare
                ha una lavorazione sua, con tempi suoi. Per questo i due servizi hanno giorni
                diversi, e non è un dettaglio di calendario.
              </p>
            </div>
          </div>
          <p className="mt-8 max-w-2xl text-base font-medium leading-relaxed text-muted">
            Ogni sacco ha un <strong className="text-navy">codice suo sul tag</strong>: dal momento
            in cui il rider lo prende sotto casa a quando torna, sappiamo dove si trova e in che
            fase è. È anche il motivo per cui nell&apos;app vedi a che punto è il tuo
            bucato senza telefonare a nessuno.
          </p>
        </div>
      </section>

      {/* L'azienda, in chiaro */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">L&apos;azienda</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">
            I dati, senza doverli cercare.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-white/65">
            Stanno anche nelle condizioni di vendita, ma lì non li apre nessuno. Qui si leggono
            subito, e si possono verificare in Camera di Commercio.
          </p>

          <dl className="mt-10 grid gap-5 sm:grid-cols-2">
            {[
              { k: "Ragione sociale", v: LEGAL.company },
              { k: "Partita IVA e codice fiscale", v: LEGAL.vat },
              { k: "REA", v: LEGAL.rea },
              { k: "Sede legale", v: LEGAL.address },
              { k: "PEC", v: LEGAL.pec },
              { k: "Amministrazione", v: LEGAL.email },
            ].map((r) => (
              <div key={r.k} className="rounded-[18px] border border-white/12 bg-white/[0.04] p-5">
                <dt className="font-display text-[11px] font-extrabold uppercase tracking-[0.18em] text-cyan">{r.k}</dt>
                <dd className="mt-1.5 text-base font-bold">{r.v}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-8 text-sm font-medium text-white/50">
            Via Franco Russoli 9 è la sede legale: non è un punto di accettazione e lì non si
            consegnano capi. Il ritiro si fa sotto casa tua.
          </p>
        </div>
      </section>

      {/* Le domande */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <h2 className="font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">Domande</h2>
          <div className="mt-8 divide-y divide-line rounded-[24px] border border-line">
            {FAQ_PAGINA.map((f) => (
              <div key={f.q} className="p-6">
                <h3 className="font-display text-base font-extrabold text-navy">{f.q}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{f.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-[28px] border border-line bg-ice p-8 text-center">
            <h2 className="font-display text-2xl font-black tracking-[-0.02em] text-navy">
              Resta da capire se passiamo da te.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base font-medium text-muted">
              Controlla il CAP: ci vogliono dieci secondi e non serve lasciare niente.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/#richiesta">Controlla il tuo CAP →</ButtonLink>
              <ButtonLink href="/prezzi" variant="ghost">
                Vedi i prezzi
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
