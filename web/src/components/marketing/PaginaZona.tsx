import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Bubbles } from "@/components/marketing/Bubbles";
import { JsonLd } from "@/components/marketing/JsonLd";
import { graficoPagina } from "@/lib/area-servita";
import { VerificaCap } from "@/components/lead/VerificaCap";

/** L'impaginazione comune delle pagine di zona.
 *
 *  Perché un componente e non tre pagine copiate
 *  ---------------------------------------------
 *  Perché la differenza fra una pagina di zona e una pagina fotocopia non sta
 *  nell'impaginazione: sta nel testo. Tre copie dello stesso file inviterebbero
 *  a cambiare solo il nome del quartiere — ed è esattamente la pagina che
 *  Google butta via (e che io stesso ho scritto nel cantiere di non fare).
 *
 *  Qui dentro sta solo quello che è uguale per tutti: il giro della settimana,
 *  il prezzo, il modulo del CAP, la struttura. Tutto il resto — il perché quella
 *  zona ha un problema di bucato suo, i CAP, le domande che si fa chi ci abita —
 *  arriva da fuori, e ogni pagina deve scriverselo.
 *
 *  I giorni non sono scritti a mano in tre posti: vengono da qui, perché il
 *  calendario generale è uno solo e il giorno che cambia deve cambiare in una
 *  riga sola. */

export type FaqZona = { q: string; a: string };

export type DatiZona = {
  /** Come si chiama la zona nel titolo: «Navigli e Ticinese». */
  nome: string;
  /** L'indirizzo completo della pagina, per canonical e dati strutturati. */
  url: string;
  /** La riga sopra l'H1. */
  kicker: string;
  /** L'H1, spezzato in due: la seconda metà va in ciano. */
  titolo: [string, string];
  /** Il paragrafo sotto il titolo. */
  intro: string;
  /** I CAP davvero coperti in questa zona. */
  cap: string[];
  /** I nomi dei quartieri o dei comuni, come li direbbe chi ci abita. */
  luoghi: string[];
  /** La parte che rende la pagina diversa dalle altre due: perché il bucato,
   *  qui, è un problema con una forma sua. */
  specifico: { titolo: string; paragrafi: string[] };
  /** Le domande di chi abita lì, non quelle generiche del servizio. */
  faq: FaqZona[];
};

/** Il giro della settimana, dal calendario generale deciso il 2 e il 12 ottobre
 *  2026 e verificato sulle fasce attive il 29 ottobre: ritiri il martedì
 *  mattina (lava e stira) e il mercoledì mattina (solo stiro), riconsegne il
 *  venerdì pomeriggio. Vale per tutte le zone: nessuna fascia appartiene a un
 *  quartiere, e scriverlo diverso su tre pagine sarebbe inventarselo. */
const GIRO = [
  { t: "Ritiro", d: "Martedì mattina, 8:30–12:00, per l'abbonamento lava e stira. Il mercoledì mattina per il solo stiro." },
  { t: "Lavorazione", d: "In lavanderia professionale, non in casa di qualcuno. Ogni sacco viaggia con il suo codice." },
  { t: "Riconsegna", d: "Venerdì pomeriggio, 14:00–18:00. Non devi esserci: ti avvisiamo prima per email." },
];

export function PaginaZona({ zona }: { zona: DatiZona }) {
  return (
    <>
      <JsonLd
        data={graficoPagina({
          nomeServizio: `Lavanderia a domicilio a ${zona.nome}`,
          descrizione: zona.intro,
          url: zona.url,
          faq: zona.faq,
        })}
      />

      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan" />
              <span className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-cyan">
                {zona.kicker}
              </span>
            </div>
            <h1 className="mt-6 max-w-3xl font-display text-4xl font-black leading-[1.05] tracking-[-0.03em] md:text-5xl">
              {zona.titolo[0]} <span className="text-cyan">{zona.titolo[1]}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/65">{zona.intro}</p>
            <div className="mt-9">
              <VerificaCap />
            </div>
            <p className="mt-6 font-display text-sm font-bold text-white/45">
              Da 160 €/mese · ritiro e riconsegna inclusi · si mette in pausa quando serve
            </p>
          </div>

          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[24px] shadow-[var(--shadow-md)] lg:aspect-[4/5] lg:max-h-[520px]">
            <Image
              src="/hero-ritiro-domicilio.webp"
              alt="Il rider WashLoop ritira il borsone del bucato sulla porta di casa"
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </section>

      {/* La parte che questa pagina non condivide con nessun'altra. */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">
            Qui, in particolare
          </div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            {zona.specifico.titolo}
          </h2>
          {zona.specifico.paragrafi.map((p) => (
            <p key={p.slice(0, 40)} className="mt-5 text-base font-medium leading-relaxed text-muted">
              {p}
            </p>
          ))}
        </div>
      </section>

      <section className="bg-ice">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Il giro della settimana</div>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Giorni fissi, così non devi ricordarti niente.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {GIRO.map((g, i) => (
              <div key={g.t} className="rounded-[24px] border border-line bg-white p-7">
                <div className="font-display text-3xl font-black text-cyan">{`0${i + 1}`}</div>
                <h3 className="mt-4 font-display text-lg font-extrabold text-navy">{g.t}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{g.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm font-medium text-muted">
            I prezzi sono gli stessi in tutta la città:{" "}
            <Link href="/prezzi" className="font-bold text-blue underline">
              vedi i piani e il listino
            </Link>
            . Se ti serve solo stirare,{" "}
            <Link href="/servizio-stiro-a-domicilio-milano" className="font-bold text-blue underline">
              c&apos;è l&apos;abbonamento solo stiro
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Dove passiamo</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            {zona.nome}, indirizzo per indirizzo.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-line bg-ice p-7">
              <div className="font-display text-sm font-extrabold text-navy">Zone</div>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted">{zona.luoghi.join(" · ")}</p>
            </div>
            <div className="rounded-[24px] border border-line bg-ice p-7">
              <div className="font-display text-sm font-extrabold text-navy">CAP</div>
              <p className="mt-3 font-display text-sm font-bold tracking-wide text-blue">{zona.cap.join(" · ")}</p>
            </div>
          </div>
          <p className="mt-6 text-sm font-medium text-muted">
            Ritiriamo in tutta Milano città e in Assago, Buccinasco e Rozzano:{" "}
            <Link href="/lavanderia-a-domicilio-milano#zone" className="font-bold text-blue underline">
              qui c&apos;è l&apos;elenco completo dei CAP
            </Link>
            . Il modulo qui sopra dice in un secondo se il tuo è coperto.
          </p>
        </div>
      </section>

      <section className="bg-ice">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Domande di chi abita qui</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Quello che ci chiedono prima di iniziare.
          </h2>
          <div className="mt-10 space-y-3">
            {zona.faq.map((f) => (
              <details key={f.q} className="group rounded-[18px] border border-line bg-white p-5">
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

      <section className="bg-grad">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center text-white">
          <h2 className="font-display text-3xl font-black tracking-[-0.02em] md:text-5xl">
            Il sacco esce di casa martedì.
            <br />
            Venerdì è già nell&apos;armadio.
          </h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/onboarding" variant="light">Attiva WashLoop →</ButtonLink>
            <ButtonLink href="/come-funziona" variant="ghost">Prima guarda come funziona →</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
