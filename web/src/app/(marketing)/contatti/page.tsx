import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Bubbles } from "@/components/marketing/Bubbles";
import { JsonLd } from "@/components/marketing/JsonLd";
import { graficoPagina, COMUNI_SERVITI } from "@/lib/area-servita";
import { LEGAL } from "@/lib/legal";
import { OG_IMMAGINE } from "@/lib/og";

/* ============================================================
   Contatti

   Perché esisteva un buco
   -----------------------
   Il numero di telefono stava **solo** dentro i dati strutturati: Google lo
   leggeva, le persone no. Su un servizio a cui consegni i vestiti di casa, un
   recapito che non si vede è un recapito che non c'è — e «chi risponde se
   succede qualcosa» è la domanda che si fa chiunque prima di abbonarsi.

   Qui non c'è un modulo di contatto: ce ne sono già due sul sito (la verifica
   CAP e la chat) e un terzo che manda una mail nel vuoto non aggiunge niente.
   Ci sono i recapiti veri, scritti in chiaro, e chi c'è dietro.
   ============================================================ */

const URL_PAGINA = "https://washloop.it/contatti";

export const metadata: Metadata = {
  title: "Contatti",
  description:
    "Telefono, email e chat di WashLoop, lavanderia a domicilio a Milano. Chi siamo, dove passiamo e come chiedere aiuto su un ritiro.",
  alternates: { canonical: "/contatti" },
  openGraph: {
    title: "Contatti — WashLoop",
    description: "Telefono, email e chat. Lavanderia a domicilio in abbonamento a Milano.",
    url: URL_PAGINA,
    type: "website",
    locale: "it_IT",
    images: [OG_IMMAGINE],
  },
};

const FAQ_PAGINA = [
  {
    q: "Come vi contatto se c'è un problema su un ritiro?",
    a: "Dall'app, nella scheda dell'ordine, c'è il tasto per segnalare: è la via più veloce perché arriva già collegata al tuo sacco e a quella data. In alternativa scrivi a info@washloop.it o usa la chat del sito.",
  },
  {
    q: "Avete un negozio dove posso portare i capi?",
    a: "No, e non è una mancanza: WashLoop è solo a domicilio. Via Franco Russoli 9 è la sede legale della società, non un punto di accettazione: non si consegnano capi lì. Il ritiro si fa sotto casa tua.",
  },
  {
    q: "Chi lava i capi?",
    a: "Lavanderie professionali partner, con cui lavoriamo a contratto. Non sono lavatrici domestiche e non sono un capannone anonimo: ogni sacco viaggia con il suo codice e sappiamo sempre in quale lavanderia si trova.",
  },
  {
    q: "In quanto tempo rispondete?",
    a: "Siamo una squadra piccola: nei giorni feriali rispondiamo in giornata, nei fine settimana può volerci di più. Se la cosa riguarda un ritiro già programmato, segnalala dall'app: quelle le guardiamo per prime.",
  },
];

const CANALI = [
  {
    t: "Telefono e WhatsApp",
    v: LEGAL.phone,
    href: `tel:${LEGAL.phone.replace(/\s/g, "")}`,
    d: "Il modo più diretto per una domanda prima di iniziare.",
  },
  {
    t: "Email",
    v: "info@washloop.it",
    href: "mailto:info@washloop.it",
    d: "Per tutto il resto. Scrivi il codice cliente se ce l'hai: accorcia il giro.",
  },
  {
    t: "Amministrazione",
    v: LEGAL.email,
    href: `mailto:${LEGAL.email}`,
    d: "Fatture, pagamenti, dati di fatturazione.",
  },
];

export default function ContattiPage() {
  return (
    <>
      <JsonLd
        data={graficoPagina({
          nomeServizio: "Lavanderia a domicilio a Milano",
          descrizione:
            "Recapiti di WashLoop, servizio di lavanderia a domicilio in abbonamento a Milano: telefono, email, chat e dati della società.",
          url: URL_PAGINA,
          faq: FAQ_PAGINA,
        })}
      />

      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto max-w-4xl px-5 py-16 md:py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">Contatti</div>
          <h1 className="mt-4 font-display text-4xl font-black leading-[1.05] tracking-[-0.03em] md:text-5xl">
            C&apos;è una persona, <span className="text-cyan">e risponde.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/65">
            WashLoop è una squadra piccola che ritira, lava e riporta il bucato a Milano. Questi
            sono i recapiti veri: non un centralino, non un modulo che finisce in una casella che
            nessuno apre.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="grid gap-4 sm:grid-cols-3">
            {CANALI.map((c) => (
              <div key={c.t} className="rounded-[24px] border border-line bg-ice p-7">
                <div className="font-display text-sm font-extrabold text-navy">{c.t}</div>
                <a href={c.href} className="mt-2 block font-display text-base font-black text-blue hover:underline">
                  {c.v}
                </a>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{c.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-[24px] border border-line bg-white p-7">
            <h2 className="font-display text-lg font-extrabold text-navy">Se il problema è su un ritiro</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-muted">
              Aprilo dall&apos;app, nella scheda dell&apos;ordine: la segnalazione arriva già
              collegata al tuo sacco, alla data e alla lavanderia che l&apos;ha lavorato. È la
              strada più corta, e quella che guardiamo per prima.
            </p>
            <div className="mt-5">
              <ButtonLink href="/app/ordini" variant="primary">Apri i tuoi ritiri →</ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ice">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Dove passiamo</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Milano città, e tre comuni intorno.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-muted">
            Ritiriamo in tutta Milano città e a {COMUNI_SERVITI.join(", ")}. L&apos;elenco completo
            dei CAP, con i giorni del giro, sta nella{" "}
            <Link href="/lavanderia-a-domicilio-milano#zone" className="font-bold text-blue underline">
              pagina del servizio
            </Link>
            . Se cerchi la tua zona:{" "}
            <Link href="/lavanderia-a-domicilio-navigli" className="font-bold text-blue underline">
              Navigli e Ticinese
            </Link>
            ,{" "}
            <Link href="/lavanderia-a-domicilio-barona-lorenteggio" className="font-bold text-blue underline">
              Barona e Lorenteggio
            </Link>
            ,{" "}
            <Link href="/lavanderia-a-domicilio-assago-buccinasco-rozzano" className="font-bold text-blue underline">
              Assago, Buccinasco e Rozzano
            </Link>
            .
          </p>

          <div className="mt-8 rounded-[24px] border border-line bg-white p-7">
            <h2 className="font-display text-sm font-extrabold text-navy">La società</h2>
            <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm font-medium text-muted sm:grid-cols-2">
              <div>
                <dt className="font-bold text-navy">Ragione sociale</dt>
                <dd>{LEGAL.company}</dd>
              </div>
              <div>
                <dt className="font-bold text-navy">Partita IVA</dt>
                <dd>{LEGAL.vat}</dd>
              </div>
              <div>
                <dt className="font-bold text-navy">REA</dt>
                <dd>{LEGAL.rea}</dd>
              </div>
              <div>
                <dt className="font-bold text-navy">PEC</dt>
                <dd>{LEGAL.pec}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-bold text-navy">Sede legale</dt>
                <dd>
                  {LEGAL.address} — è la sede della società, non un punto di accettazione: i capi
                  non si consegnano qui.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Le domande che ci fanno al telefono.
          </h2>
          <div className="mt-10 space-y-3">
            {FAQ_PAGINA.map((f) => (
              <details key={f.q} className="group rounded-[18px] border border-line bg-ice p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-extrabold text-navy">
                  {f.q}
                  <span className="ml-4 text-cyan transition-transform group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm font-medium leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
