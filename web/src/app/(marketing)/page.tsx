import type { Metadata } from "next";
import Image from "next/image";
import { Bubbles } from "@/components/marketing/Bubbles";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ZonaProvider } from "@/components/home/ZonaContext";
import { CapCheck } from "@/components/home/CapCheck";
import { RichiestaZona } from "@/components/home/RichiestaZona";
import { graficoPagina } from "@/lib/area-servita";

/* ============================================================
   Home — la pagina che raccoglie i contatti.

   Cinque sezioni, e non una di più: hero con il controllo CAP, tre pilastri,
   come funziona, cosa entra nel borsone, richiesta. È la struttura approvata,
   e la brevità è il punto — la home precedente vendeva, aveva comparativa,
   listino e checkout, e non portava contatti.

   Qui c'erano anche prezzi, domande frequenti, zone coperte e un richiamo
   finale: li avevo aggiunti io per non lasciare orfane tre voci del menu, ed è
   stato l'errore. Il menu si sistema (ed è stato sistemato); una pagina che
   chiede una cosa sola non si allunga per far quadrare una navigazione.

   Chi vuole la spiegazione lunga la trova nelle due pagine di servizio, chi
   vuole comprare ha «Attiva WashLoop» in cima a ogni pagina, chi è già cliente
   ha «Accedi» accanto.
   ============================================================ */

export const metadata: Metadata = {
  // `absolute` perché il layout di base applica il suffisso «· WashLoop»: qui
  // il marchio è già nel titolo, e senza questa riga usciva due volte.
  title: { absolute: "WashLoop — Lavanderia a domicilio a Milano, in abbonamento" },
  description:
    "Scopri in 10 secondi se WashLoop passa da te. Ritiro fisso a domicilio, lavaggio e stiratura professionali, riconsegna entro 3 giorni feriali. Piani da 160 €/mese, ritiro e consegna inclusi.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "WashLoop — Lavanderia a domicilio a Milano",
    description: "Ritiro fisso a domicilio, lavaggio e stiratura professionali, riconsegna entro 3 giorni feriali. Controlla se passiamo dal tuo CAP.",
    url: "https://washloop.it",
    type: "website",
    locale: "it_IT",
  },
};

function Tratto({ children, size = 34 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const PILASTRI = [
  {
    t: "Un giorno fisso",
    d: "Sempre lo stesso giorno della settimana: entra nella routine e smette di essere una cosa da ricordare.",
    icona: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </>
    ),
  },
  {
    t: "Lavaggio e stiratura professionali",
    d: "Lavanderia vera, non una lavatrice in più. Lo stiro è dentro l'abbonamento, non un supplemento a capo.",
    icona: (
      <>
        <path d="M12 8a2.2 2.2 0 1 1 2.2-2.2" />
        <path d="M12 8v2.2L3.6 16.4A1.6 1.6 0 0 0 4.5 19.5h15a1.6 1.6 0 0 0 .9-3.1L12 10.2" />
      </>
    ),
  },
  {
    t: "Riconsegna entro 3 giorni",
    d: "Tre giorni feriali dal ritiro. La riconsegna la programmiamo noi: tu ricevi giorno e ora per email.",
    icona: (
      <>
        <path d="M2.5 7.5h11v9h-11z" />
        <path d="M13.5 11h4l3 3v2.5h-7z" />
        <circle cx="7" cy="18" r="1.8" />
        <circle cx="17" cy="18" r="1.8" />
      </>
    ),
  },
];

const PASSI = [
  {
    n: "1",
    t: "Metti i capi nel sacco",
    d: "Quello che finirebbe in lavatrice. Non devi dividere, contare o trattare niente.",
    icona: (
      <>
        <path d="M9 3.5h6l-1.2 3.2a3 3 0 0 0 .5 3l3.4 4.2a5.5 5.5 0 0 1-4.3 8.9h-2.8a5.5 5.5 0 0 1-4.3-8.9l3.4-4.2a3 3 0 0 0 .5-3z" />
      </>
    ),
  },
  {
    n: "2",
    t: "Passiamo noi",
    d: "Il rider ritira sotto casa nel giorno fisso. Ogni sacco viene tracciato con il suo codice.",
    icona: (
      <>
        <path d="M5.5 7.5h8v9h-8z" />
        <path d="M13.5 11h3.5l3 3v2.5h-6.5z" />
        <circle cx="9" cy="18" r="1.7" />
        <circle cx="17.5" cy="18" r="1.7" />
        <path d="M1.5 10h2.5M1.5 13.5h2.5" />
      </>
    ),
  },
  {
    n: "3",
    t: "Te li riconsegniamo pronti",
    d: "Lavati, stirati e piegati, entro 3 giorni feriali. Si aprono e si ripongono.",
    icona: (
      <>
        <path d="M9 3.5 12 6l3-2.5 4.5 2.2-1.8 4.3-1.7-.6V20H7V9.4l-1.7.6L3.5 5.7z" />
        <path d="m18.8 15.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
      </>
    ),
  },
];

const NEL_SACCO = ["Camicie", "Magliette", "Asciugamani", "Lenzuola", "Calzini", "Biancheria intima"];

export default function Home() {
  return (
    <ZonaProvider>
      {/* Niente `FAQPage` qui: Google accetta quel blocco solo se le domande
          sono visibili nella pagina, e questa non le mostra più. Restano
          l'attività e il servizio, che la pagina descrive davvero. */}
      <JsonLd
        data={graficoPagina({
          nomeServizio: "Lavanderia a domicilio in abbonamento a Milano",
          descrizione:
            "Ritiro fisso a domicilio, lavaggio e stiratura professionali, riconsegna entro 3 giorni feriali. Abbonamento mensile con ritiro e consegna inclusi.",
          url: "https://washloop.it/",
        })}
      />

      {/* ============ 1 · HERO ============ */}
      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            {/* La riga sopra il titolo dice cos'è il servizio, e il titolo no.
                «Scopri in 10 secondi se WashLoop passa anche da te» è una
                promessa, non una descrizione: chi arriva da una ricerca non ci
                trova dentro nessuna delle parole che ha digitato. Questa riga
                le mette in chiaro, sopra la piega e in testo vero.

                Un `<p>` e non un secondo titolo: due intestazioni in cima si
                toglierebbero peso a vicenda, e l'H1 della pagina resta uno. */}
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">
              Lavanderia a domicilio in abbonamento
            </p>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.05] tracking-[-0.03em] md:text-5xl xl:text-6xl">
              Scopri in 10 secondi
              <br />
              se WashLoop passa <span className="text-cyan">anche da te.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg font-medium leading-relaxed text-white/65">
              Ritiro fisso a domicilio, lavaggio e stiratura professionali, riconsegna entro
              3 giorni feriali.
            </p>
            <CapCheck />
            <p className="mt-5 font-display text-sm font-bold text-white/45">
              Piani da 160 €/mese · ritiro e consegna inclusi
            </p>
          </div>

          {/* La foto del ritiro.
              Un solo elemento e non due — una versione per telefono e una per
              schermo grande — perché un'immagine nascosta con `display:none` il
              browser spesso la scarica lo stesso: sarebbero due file su una
              connessione mobile per vederne uno. Qui cambia solo la forma:
              banda larga sul telefono, riquadro alto accanto al testo sul
              desktop.

              `priority` perché è l'elemento più grande sopra la piega: senza,
              Next la carica pigramente e il tempo di disegno della pagina lo
              misura Google su di lei. */}
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[24px] shadow-[var(--shadow-md)] lg:aspect-[4/5] lg:max-h-[520px]">
            <Image
              src="/hero-ritiro-domicilio.webp"
              alt="Un rider WashLoop consegna il borsone del bucato a una cliente sulla porta di casa, a Milano"
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
              // Il ritaglio verticale del desktop mostra poco più di metà della
              // foto: centrato tagliava a metà il volto della cliente, e la
              // scena diventava la schiena di un fattorino. Spostato a destra
              // tiene dentro lo scambio del borsone e tutti e due.
              className="object-cover object-[64%_center] lg:object-[62%_center]"
            />
          </div>
        </div>
      </section>

      {/* ============ 2 · TRE PILASTRI ============ */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-14 md:grid-cols-3">
          {PILASTRI.map((p) => (
            <div key={p.t} className="rounded-[24px] border border-line bg-white p-7 text-center">
              <span className="inline-flex text-cyan"><Tratto>{p.icona}</Tratto></span>
              <h2 className="mt-4 font-display text-lg font-extrabold leading-snug text-navy">{p.t}</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 3 · COME FUNZIONA ============ */}
      <section id="come-funziona" className="scroll-mt-20 bg-ice">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-center font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Come funziona
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {PASSI.map((s) => (
              <div key={s.n} className="text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan/15 font-display text-base font-black text-blue">
                  {s.n}
                </span>
                <span className="mt-5 flex justify-center text-navy"><Tratto size={44}>{s.icona}</Tratto></span>
                <h3 className="mt-5 font-display text-lg font-extrabold text-navy">{s.t}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm font-medium leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 4 · UN BORSONE ============ */}
      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-[auto_1fr] md:gap-14">
          {/* Il borsone disegnato a tratto, come nel progetto: non è una foto e
              non vuole esserlo — è il segno che tiene insieme la sezione, con
              lo stesso spessore di linea delle icone qui sopra. */}
          <div className="mx-auto w-full max-w-[260px] text-cyan md:mx-0 md:border-r md:border-white/10 md:pr-14">
            <svg viewBox="0 0 200 140" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-full" aria-hidden>
              <path d="M28 52h144a14 14 0 0 1 14 14v38a14 14 0 0 1-14 14H28a14 14 0 0 1-14-14V66a14 14 0 0 1 14-14Z" />
              <path d="M72 52V40a10 10 0 0 1 10-10h36a10 10 0 0 1 10 10v12" />
              <path d="M72 30c0 16 10 24 28 24s28-8 28-24" opacity="0.45" />
              <path d="M14 78h172" opacity="0.35" />
              <path d="M52 118v10M148 118v10" />
              <circle cx="100" cy="90" r="16" opacity="0.5" />
              <circle cx="94" cy="86" r="4" />
              <circle cx="105" cy="93" r="6" />
            </svg>
          </div>

          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">
              Un borsone. Tutto il tuo bucato.
            </div>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">
              Tutto quello che metteresti in lavatrice<span className="text-cyan">.</span>
            </h2>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {NEL_SACCO.map((c) => (
                <span key={c} className="rounded-full border border-white/20 bg-white/5 px-4 py-2 font-display text-sm font-bold text-white/85">
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-8 max-w-2xl text-base font-medium leading-relaxed text-white/65">
              WashLoop è il servizio in abbonamento per la gestione del guardaroba. È nato per
              evitare che tu faccia la lavatrice: ritiriamo, laviamo, stiriamo e riconsegniamo
              i capi pronti per l&apos;armadio.
            </p>
          </div>
        </div>
      </section>

      {/* ============ 5 · RICHIESTA ============ */}
      <section id="richiesta" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <RichiestaZona />
        </div>
      </section>
    </ZonaProvider>
  );
}
