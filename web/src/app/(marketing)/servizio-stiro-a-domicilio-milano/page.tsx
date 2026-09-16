import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Bubbles } from "@/components/marketing/Bubbles";
import { JsonLd } from "@/components/marketing/JsonLd";
import { CAP_SERVITI, ZONE_SERVITE, COMUNI_SERVITI, graficoPagina } from "@/lib/area-servita";

/* ============================================================
   Pagina di ricerca — "servizio stiro a domicilio Milano"

   Perché è una pagina a sé e non un paragrafo dell'altra
   -----------------------------------------------------
   Perché è una domanda diversa. Chi cerca «lavanderia a domicilio» vuole
   liberarsi del bucato; chi cerca «servizio stiro» ha già la lavatrice che gira
   e vuole liberarsi **dell'asse da stiro** — spesso è la persona che lava in
   casa e accumula una pila di camicie che non affronta.

   Il servizio dietro è lo stesso, ma questa pagina non ripete l'altra: se
   due pagine dello stesso sito dicono la stessa cosa con parole diverse, si
   tolgono posizioni a vicenda e Google ne sceglie una sola. Qui si parla di
   stiro — cosa stiriamo, come torna, perché è compreso e non un extra — e
   l'altra la si linka invece di riassumerla.
   ============================================================ */

const URL_PAGINA = "https://washloop.it/servizio-stiro-a-domicilio-milano";

export const metadata: Metadata = {
  title: "Servizio stiro a domicilio a Milano — camicie stirate e piegate",
  description:
    "Servizio di stiro a domicilio a Milano: ritiriamo i capi sotto casa, li laviamo e stiriamo e te li riconsegniamo piegati entro 3 giorni feriali. Stiratura inclusa nell'abbonamento, non è un extra.",
  alternates: { canonical: "/servizio-stiro-a-domicilio-milano" },
  openGraph: {
    title: "Servizio stiro a domicilio a Milano — WashLoop",
    description: "Camicie stirate, piegate e riconsegnate a casa entro 3 giorni feriali. Lo stiro è dentro l'abbonamento, non un supplemento.",
    url: URL_PAGINA,
    type: "website",
    locale: "it_IT",
  },
};

/** Le domande di chi cerca lo stiro, che non sono quelle di chi cerca il
 *  lavaggio: la prima cosa che vuole sapere è se lo stiro si può prendere da
 *  solo, e la risposta onesta è no. Meglio dirlo qui che dopo il pagamento. */
const FAQ_PAGINA = [
  {
    q: "Posso far stirare senza far lavare?",
    a: "No: WashLoop lava e stira nello stesso passaggio, non offriamo lo stiro separato. È una scelta, non un limite tecnico — un capo lavato da noi lo stiriamo sapendo com'è stato trattato, e il risultato è più costante. Se cerchi solo la stiratura di capi già lavati in casa, non siamo il servizio giusto e preferiamo dirtelo subito.",
  },
  {
    q: "Quali capi stirate?",
    a: "Tutti quelli che lo richiedono: camicie, camicette, pantaloni, magliette, lenzuola e federe. Biancheria, asciugamani e calzini tornano lavati e piegati — stirarli non serve a nessuno e non li stiriamo.",
  },
  {
    q: "La stiratura è compresa nel prezzo?",
    a: "Sì. Lavaggio e stiratura stanno nello stesso abbonamento, da 160 €/mese, insieme al ritiro e alla riconsegna. Non c'è un supplemento per capo stirato e non c'è un carrello da riempire.",
  },
  {
    q: "Quante camicie sono incluse?",
    a: "Fino a 3 camicie per sacchetto. Se ne metti di più, quelle oltre la soglia le vedi addebitate a listino, con il prezzo scritto prima: non ci sono sorprese a fine mese.",
  },
  {
    q: "Come tornano i capi stirati?",
    a: "Piegati e ordinati, pronti da riporre nell'armadio senza un altro gesto. Non arriva un sacco da svuotare e risistemare: quel passaggio è metà del lavoro, e lo facciamo noi.",
  },
  {
    q: "Quanto tempo ci vuole?",
    a: "Entro 3 giorni feriali dal ritiro. Il ritiro è un giorno fisso a settimana, la fascia la scegli tu; la riconsegna la programmiamo noi e ti avvisiamo per email con giorno e ora.",
  },
];

const PASSI = [
  { n: "01", t: "Affidi i capi", d: "Camicie e biancheria quotidiana nel sacco. Senza pila da affrontare la domenica sera, senza asse da tirare fuori." },
  { n: "02", t: "Li trattiamo", d: "Lavaggio e stiratura professionali nello stesso passaggio: colli, polsini e pieghe curati da chi lo fa di mestiere." },
  { n: "03", t: "Tornano pronti", d: "Piegati e ordinati, entro 3 giorni feriali. Si aprono e si ripongono: nessun altro gesto da parte tua." },
];

const COSA_STIRIAMO = ["Camicie", "Camicette", "Pantaloni", "Magliette", "Lenzuola", "Federe"];
const COSA_NO = ["Biancheria intima", "Calzini", "Asciugamani", "Accappatoi"];

const MOTIVI = [
  {
    t: "Lo stiro è la parte che nessuno vuole fare",
    d: "Lavare è premere un pulsante. Stirare è un'ora in piedi, e infatti è il passaggio che si rimanda: la pila cresce finché non resta una camicia pulita da mettere.",
  },
  {
    t: "Incluso, non un supplemento",
    d: "Molti servizi fanno pagare lo stiro a capo, e il conto lo scopri alla fine. Qui sta dentro l'abbonamento: il prezzo del mese lo sai prima di iniziare.",
  },
  {
    t: "Tornano piegati, non da risistemare",
    d: "La riconsegna è parte del lavoro. I capi arrivano ordinati e pronti da riporre, non ammucchiati in un sacco che devi svuotare tu.",
  },
];

export default function ServizioStiroADomicilioMilano() {
  return (
    <>
      <JsonLd
        data={graficoPagina({
          nomeServizio: "Servizio di stiratura a domicilio a Milano",
          descrizione:
            "Servizio di stiro a domicilio a Milano in abbonamento: ritiro settimanale sotto casa, lavaggio e stiratura professionali, riconsegna dei capi piegati entro 3 giorni feriali.",
          url: URL_PAGINA,
          faq: FAQ_PAGINA,
        })}
      />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan" />
            <span className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-cyan">
              Stiratura professionale · Milano
            </span>
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-4xl font-black leading-[1.05] tracking-[-0.03em] md:text-6xl">
            Servizio stiro a domicilio
            <br />
            a Milano. <span className="text-cyan">L&apos;asse resta chiuso.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/65">
            Ritiriamo i capi sotto casa, li laviamo e stiriamo in lavanderia professionale e te
            li riportiamo piegati entro 3 giorni feriali. La stiratura è dentro
            l&apos;abbonamento: nessun supplemento a capo.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/onboarding">Attiva WashLoop →</ButtonLink>
            <ButtonLink href="/disponibilita" variant="ghost">
              Controlla se copriamo il tuo CAP →
            </ButtonLink>
          </div>
          <p className="mt-6 font-display text-sm font-bold text-white/45">
            Da 160 €/mese · lavaggio e stiro inclusi · fino a 3 camicie per sacchetto
          </p>
        </div>
      </section>

      {/* ============ COME FUNZIONA ============ */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">La pila, smontata</div>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Dal sacco all&apos;armadio, senza passare dall&apos;asse.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PASSI.map((s) => (
              <div key={s.n} className="rounded-[24px] border border-line bg-ice p-7">
                <div className="font-display text-3xl font-black text-cyan">{s.n}</div>
                <h3 className="mt-4 font-display text-lg font-extrabold text-navy">{s.t}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COSA STIRIAMO ============ */}
      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2">
          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">La cura è nei dettagli</div>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">
              Stiriamo quello che si vede addosso.
            </h2>
            <p className="mt-4 max-w-md text-base font-medium text-white/65">
              Colli, polsini, pieghe dei pantaloni: le parti che si notano quando esci di casa e
              che a mano vengono bene solo se hai tempo. Il resto — biancheria, asciugamani,
              calzini — torna lavato e piegato, perché stirarlo non serve a nessuno.
            </p>
            <p className="mt-4 max-w-md text-base font-medium text-white/65">
              Lavaggio e stiratura avvengono nello stesso passaggio, in una lavanderia
              professionale: sappiamo come il capo è stato trattato, e il risultato non dipende
              da chi ha l&apos;asse quel giorno.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-8">
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.2em] text-cyan">Li stiriamo</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {COSA_STIRIAMO.map((c) => (
                <span key={c} className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-display text-sm font-bold text-white/85">
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-7 border-t border-white/10 pt-5">
              <div className="font-display text-xs font-extrabold uppercase tracking-[0.2em] text-white/40">Tornano piegati, non stirati</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {COSA_NO.map((c) => (
                  <span key={c} className="rounded-full border border-white/10 px-3.5 py-1.5 font-display text-sm font-bold text-white/45">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PERCHÉ ============ */}
      <section className="bg-ice">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Perché delegarlo</div>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Un&apos;ora in piedi, ogni settimana, per sempre.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {MOTIVI.map((m) => (
              <div key={m.t} className="rounded-[24px] border border-line bg-white p-7">
                <h3 className="font-display text-lg font-extrabold text-navy">{m.t}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{m.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DOVE ============ */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Dove passiamo</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Milano sud-ovest, e i comuni intorno.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-muted">
            Ritiriamo e riconsegniamo di persona, quindi copriamo solo dove passiamo ogni
            settimana: {ZONE_SERVITE.join(", ")}, e fuori città {COMUNI_SERVITI.join(", ")}.
          </p>
          <div className="mt-8 rounded-[24px] border border-line bg-ice p-7">
            <div className="font-display text-sm font-extrabold text-navy">CAP coperti</div>
            <p className="mt-3 font-display text-sm font-bold tracking-wide text-blue">{CAP_SERVITI.join(" · ")}</p>
            <p className="mt-3 text-sm font-medium text-muted">
              Il tuo non c&apos;è?{" "}
              <Link href="/disponibilita" className="font-bold text-blue hover:underline">
                Lasciaci il CAP
              </Link>{" "}
              e ti avvisiamo appena apriamo nella tua zona.
            </p>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-ice">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Domande prima di iniziare</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Come funziona lo stiro, detto chiaro.
          </h2>
          <div className="mt-10 space-y-3">
            {FAQ_PAGINA.map((f) => (
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

      {/* ============ CTA ============ */}
      <section className="bg-grad">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center text-white">
          <h2 className="font-display text-3xl font-black tracking-[-0.02em] md:text-5xl">
            L&apos;ultima volta che tiri fuori l&apos;asse.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg font-medium text-white/85">
            Se passiamo dalla tua zona, la prossima pila la smontiamo noi.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/onboarding" variant="light">Attiva WashLoop →</ButtonLink>
            <ButtonLink href="/lavanderia-a-domicilio-milano" variant="ghost">
              Come funziona il servizio completo →
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
