import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Bubbles } from "@/components/marketing/Bubbles";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ZonaProvider } from "@/components/home/ZonaContext";
import { CapCheck } from "@/components/home/CapCheck";
import { RichiestaZona } from "@/components/home/RichiestaZona";
import { FAQ } from "@/lib/faq";
import { CAP_SERVITI, ZONE_SERVITE, COMUNI_SERVITI, graficoPagina } from "@/lib/area-servita";

/* ============================================================
   Home — la pagina che raccoglie i contatti.

   Cosa è cambiato, e perché
   -------------------------
   La home precedente vendeva: comparativa con la concorrenza, tre piani a
   prezzo pieno, checkout diretto. Non portava contatti — e per un servizio che
   copre mezza città, con la copertura da confermare a voce, chiedere 160 € al
   primo incontro è un cancello, non una porta.

   Questa chiede una cosa sola: **il CAP**. È l'unica domanda a cui si risponde
   senza pensarci, e apre la conversazione invece di chiuderla. Il resto —
   email e telefono — lo si dà dopo, quando si è già ricevuto qualcosa in
   cambio: una risposta.

   La vecchia è viva su `/home-old`, fuori dall'indice: se questo taglio non
   funziona, si riparte da lì senza rifarla.

   Acquisto e accesso restano in alto, nell'header del sito («Accedi» e «Attiva
   WashLoop»): chi ha già deciso non deve passare da un modulo di contatto per
   comprare, e chi è già cliente non deve cercarsi l'ingresso.
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
  { n: "1", t: "Metti i capi nel sacco", d: "Quello che finirebbe in lavatrice. Non devi dividere, contare o trattare niente." },
  { n: "2", t: "Passiamo noi", d: "Il rider ritira sotto casa nel giorno fisso. Ogni sacco viene tracciato con il suo codice." },
  { n: "3", t: "Te li riconsegniamo pronti", d: "Lavati, stirati e piegati, entro 3 giorni feriali. Si aprono e si ripongono." },
];

const NEL_SACCO = ["Camicie", "Magliette", "Asciugamani", "Lenzuola", "Calzini", "Biancheria intima"];

const PIANI = [
  { nome: "Small", code: "essential", prezzo: "160", riga: "1 sacco a settimana" },
  { nome: "Medium", code: "plus", prezzo: "280", riga: "2 sacchi a settimana", popolare: true },
  { nome: "Large", code: "family", prezzo: "390", riga: "3 sacchi a settimana" },
];

function Icona({ children }: { children: React.ReactNode }) {
  return (
    <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export default function Home() {
  return (
    <ZonaProvider>
      <JsonLd
        data={graficoPagina({
          nomeServizio: "Lavanderia a domicilio in abbonamento a Milano",
          descrizione:
            "Ritiro fisso a domicilio, lavaggio e stiratura professionali, riconsegna entro 3 giorni feriali. Abbonamento mensile con ritiro e consegna inclusi.",
          url: "https://washloop.it/",
          faq: FAQ,
        })}
      />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            <h1 className="font-display text-4xl font-black leading-[1.05] tracking-[-0.03em] md:text-5xl xl:text-6xl">
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
              className="object-cover object-center"
            />
          </div>
        </div>
      </section>

      {/* ============ TRE PILASTRI ============ */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-14 md:grid-cols-3">
          {PILASTRI.map((p) => (
            <div key={p.t} className="rounded-[24px] border border-line bg-white p-7 text-center">
              <span className="inline-flex text-cyan"><Icona>{p.icona}</Icona></span>
              <h2 className="mt-4 font-display text-lg font-extrabold leading-snug text-navy">{p.t}</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ COME FUNZIONA ============ */}
      <section id="come-funziona" className="scroll-mt-20 bg-ice">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-center font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Come funziona
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {PASSI.map((s) => (
              <div key={s.n} className="text-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-cyan/15 font-display text-lg font-black text-blue">
                  {s.n}
                </span>
                <h3 className="mt-5 font-display text-lg font-extrabold text-navy">{s.t}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm font-medium leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COSA METTI NEL SACCO ============ */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
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
            i capi pronti per l&apos;armadio. I capi da lavasecco vanno in un sacco separato e
            si lavorano a listino.
          </p>
        </div>
      </section>

      {/* ============ RICHIESTA ============ */}
      <section id="richiesta" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <RichiestaZona />
        </div>
      </section>

      {/* ============ PREZZI ============ */}
      {/* Il listino resta, ma dopo il form e senza la tabella comparativa: chi
          arriva qui sotto ha già deciso di guardare i numeri, e a quel punto
          nasconderli sarebbe un gioco. Chi vuole comprare subito ha «Attiva
          WashLoop» in cima a ogni pagina. */}
      <section id="prezzi" className="scroll-mt-20 bg-ice">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <div className="text-center">
            <h2 className="font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
              Quanto costa
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base font-medium text-muted">
              Ritiro e riconsegna sempre inclusi. Metti in pausa quando vuoi, nessun vincolo di
              durata.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PIANI.map((p) => (
              <div
                key={p.nome}
                className={
                  p.popolare
                    ? "relative rounded-[24px] bg-navy p-7 text-white shadow-[var(--shadow-md)]"
                    : "relative rounded-[24px] border border-line bg-white p-7"
                }
              >
                {p.popolare && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-grad px-3 py-1 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-white">
                    Più scelto
                  </div>
                )}
                <h3 className={`font-display text-lg font-black ${p.popolare ? "text-white" : "text-navy"}`}>{p.nome}</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className={`font-display text-4xl font-black ${p.popolare ? "text-white" : "text-navy"}`}>€{p.prezzo}</span>
                  <span className={`mb-1 text-sm font-semibold ${p.popolare ? "text-white/55" : "text-muted"}`}>/mese</span>
                </div>
                <p className={`mt-2 text-sm font-semibold ${p.popolare ? "text-white/70" : "text-muted"}`}>{p.riga}</p>
                <ButtonLink href={`/onboarding?plan=${p.code}`} variant={p.popolare ? "light" : "primary"} size="md" className="mt-6 w-full">
                  Attiva {p.nome} →
                </ButtonLink>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-7 max-w-2xl text-center text-sm font-medium text-muted">
            Ogni sacchetto contiene fino a 3 camicie. Sacchi extra a €45 l&apos;uno. I capi da
            lavanderia, in un sacco separato, si lavorano a prezzo di listino.
          </p>
        </div>
      </section>

      {/* ============ DOVE PASSIAMO ============ */}
      <section id="area" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Dove passiamo</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Milano, a partire dal sud-ovest.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-muted">
            Il giro settimanale copre oggi {ZONE_SERVITE.join(", ")} e, fuori città,{" "}
            {COMUNI_SERVITI.join(", ")}. Sul resto di Milano prendiamo la richiesta e
            confermiamo al telefono: è così che decidiamo dove allargare.
          </p>
          <div className="mt-7 rounded-[24px] border border-line bg-ice p-7">
            <div className="font-display text-sm font-extrabold text-navy">CAP del giro attuale</div>
            <p className="mt-3 font-display text-sm font-bold tracking-wide text-blue">{CAP_SERVITI.join(" · ")}</p>
            <p className="mt-3 text-sm font-medium text-muted">
              Il tuo non c&apos;è?{" "}
              <a href="#richiesta" className="font-bold text-blue hover:underline">Lascialo comunque</a>: dove
              arriviamo dopo lo decidono le richieste che riceviamo.
            </p>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="scroll-mt-20 bg-ice">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-center font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Domande frequenti
          </h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-[18px] border border-line bg-white p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-extrabold text-navy">
                  {f.q}
                  <span className="ml-4 text-cyan transition-transform group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm font-medium leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center text-sm font-medium text-muted">
            Vuoi capire meglio?{" "}
            <Link href="/lavanderia-a-domicilio-milano" className="font-bold text-blue hover:underline">
              Come funziona la lavanderia a domicilio
            </Link>{" "}
            ·{" "}
            <Link href="/servizio-stiro-a-domicilio-milano" className="font-bold text-blue hover:underline">
              Il servizio stiro
            </Link>
          </p>
        </div>
      </section>

      {/* ============ CTA FINALE ============ */}
      <section className="bg-grad">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center text-white">
          <h2 className="font-display text-3xl font-black tracking-[-0.02em] md:text-5xl">
            Dieci secondi adesso.
            <br />
            Un&apos;ora a settimana per sempre.
          </h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#richiesta"
              className="inline-flex min-h-[56px] items-center justify-center gap-2.5 rounded-[40px] bg-white px-7 font-display text-base font-extrabold text-navy shadow-[var(--shadow-md)] transition-transform hover:-translate-y-0.5"
            >
              Controlla il tuo CAP →
            </a>
            <ButtonLink href="/onboarding" variant="ghost">Attiva subito →</ButtonLink>
          </div>
          <p className="mt-5 text-sm font-semibold text-white/70">
            <Link href="/login" className="underline">Hai già un account? Accedi</Link>
          </p>
        </div>
      </section>
    </ZonaProvider>
  );
}
