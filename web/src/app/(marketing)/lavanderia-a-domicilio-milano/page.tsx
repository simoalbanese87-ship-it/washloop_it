import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { Bubbles } from "@/components/marketing/Bubbles";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ZONE_SERVITE, COMUNI_SERVITI, graficoPagina } from "@/lib/area-servita";
import { CAP_MILANO, CAP_COMUNI } from "@/lib/copertura";
import { VerificaCap } from "@/components/lead/VerificaCap";

/* ============================================================
   Pagina di ricerca — "lavanderia a domicilio Milano"

   Perché esiste
   -------------
   Cercando "washloop" Google mostrava l'Informativa Privacy come secondo
   risultato. Non era un errore suo: di pagine pubbliche con del contenuto ce
   n'era **una**, la home, e fra quel che restava le legali erano le uniche con
   del testo. Questa e la gemella sullo stiro sono le pagine che quel posto se
   lo meritano.

   Il servizio è lo stesso della home, ma la pagina non è una sua copia — e non
   deve esserlo: due pagine che dicono la stessa cosa con parole diverse si
   tolgono posizioni a vicenda. Qui si risponde a una domanda precisa, «chi
   ritira e lava il bucato a casa mia a Milano», con le cose che la home non
   dice: **dove passiamo davvero**, CAP per CAP, e cosa entra nel sacco.
   ============================================================ */

const URL_PAGINA = "https://washloop.it/lavanderia-a-domicilio-milano";

export const metadata: Metadata = {
  title: "Lavanderia a domicilio a Milano — ritiro, lavaggio e stiro",
  description:
    "Lavanderia a domicilio a Milano in abbonamento: ritiriamo il sacco sotto casa, laviamo e stiriamo, riconsegniamo entro 3 giorni feriali. Navigli, Tortona, Barona, Lorenteggio, Assago, Buccinasco, Rozzano.",
  alternates: { canonical: "/lavanderia-a-domicilio-milano" },
  openGraph: {
    title: "Lavanderia a domicilio a Milano — WashLoop",
    description: "Ritiro sotto casa, lavaggio e stiratura professionali, riconsegna entro 3 giorni feriali. Da 160 €/mese, ritiro e consegna inclusi.",
    url: URL_PAGINA,
    type: "website",
    locale: "it_IT",
  },
};

/** Le domande di questa pagina.
 *
 *  Non sono le FAQ della home riscritte: quelle rispondono a chi ha già deciso
 *  e vuole i dettagli dell'abbonamento. Queste rispondono a chi ci ha appena
 *  trovato e non sa ancora se siamo un lavasecco, un'app o un fattorino. Finite
 *  anche nei dati strutturati, quindi Google può mostrarle già aperte nel
 *  risultato. */
const FAQ_PAGINA = [
  {
    q: "Come funziona una lavanderia a domicilio?",
    a: "Metti nel sacco quello che normalmente laveresti in lavatrice. Un giorno fisso a settimana il nostro rider passa a ritirarlo sotto casa, noi laviamo e stiriamo in lavanderia professionale, e ti riconsegniamo tutto piegato e pronto entro 3 giorni feriali. Non devi essere a casa al ritorno: la riconsegna te la programmiamo noi e ti avvisiamo per email con giorno e ora.",
  },
  {
    q: "Quanto costa la lavanderia a domicilio a Milano?",
    a: "WashLoop è un abbonamento mensile: 160 € per 1 sacco a settimana, 280 € per 2, 390 € per 3. Ritiro e riconsegna sono sempre inclusi, non si pagano a parte. Ogni sacchetto comprende fino a 3 camicie stirate.",
  },
  {
    q: "In quali zone di Milano ritirate?",
    a: `Siamo partiti da Milano sud-ovest: ${ZONE_SERVITE.join(", ")}. Fuori città serviamo ${COMUNI_SERVITI.join(", ")}. Ritiriamo in tutta Milano città, dal 20121 al 20162, e la disponibilità della settimana la confermiamo al telefono. Se il tuo non è in elenco lasciaci il contatto: ti avvisiamo appena apriamo nella tua zona.`,
  },
  {
    q: "Cosa posso mettere nel sacco?",
    a: "Tutto quello che finirebbe in lavatrice: camicie, magliette, pantaloni, biancheria, asciugamani, lenzuola. I capi delicati o da lavasecco vanno in un sacco separato e si lavorano a prezzo di listino, fuori dal volume dell'abbonamento.",
  },
  {
    q: "Devo essere a casa per il ritiro?",
    a: "Al ritiro sì, o comunque qualcuno che consegni il sacco: scegli tu giorno e fascia oraria dall'app. Alla riconsegna no — programmiamo noi il rientro e ti avvisiamo prima.",
  },
  {
    q: "Posso mettere in pausa l'abbonamento?",
    a: "Sì, dall'app, per un mese intero. Vai in vacanza e non paghi un servizio che non usi. Nessun vincolo di durata.",
  },
];

const PASSI = [
  { n: "01", t: "Riempi il sacco", d: "Quello che metteresti in lavatrice. Non devi dividere, contare o trattare niente: pensiamo noi a separare." },
  { n: "02", t: "Passiamo noi", d: "Un giorno fisso a settimana, la fascia la scegli tu. Il rider ritira sotto casa e ogni sacco viene tracciato con il suo codice." },
  { n: "03", t: "Torna pronto", d: "Lavato, stirato e piegato, entro 3 giorni feriali. La riconsegna la programmiamo noi: tu ricevi giorno e ora per email." },
];

const COSA_ENTRA = ["Camicie", "Magliette", "Pantaloni", "Felpe", "Biancheria intima", "Calzini", "Asciugamani", "Lenzuola", "Federe"];

const MOTIVI = [
  { t: "Un giorno fisso, non una corsa", d: "Non devi ricordarti di prenotare ogni volta. Il ritiro è sempre lo stesso giorno della settimana: entra nella routine e sparisce dai pensieri." },
  { t: "Lavaggio e stiratura nello stesso prezzo", d: "Lo stiro non è un extra da aggiungere al carrello. È dentro l'abbonamento, su tutti i capi che lo richiedono." },
  { t: "Ogni sacco ha il suo codice", d: "Ogni sacco viene etichettato e seguito passo per passo. Se qualcosa non torna, sappiamo dove guardare invece di chiedertelo." },
];

export default function LavanderiaADomicilioMilano() {
  return (
    <>
      <JsonLd
        data={graficoPagina({
          nomeServizio: "Lavanderia a domicilio a Milano",
          descrizione:
            "Servizio di lavanderia a domicilio in abbonamento a Milano: ritiro settimanale sotto casa, lavaggio e stiratura professionali, riconsegna entro 3 giorni feriali.",
          url: URL_PAGINA,
          faq: FAQ_PAGINA,
        })}
      />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan" />
            <span className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-cyan">
              Milano · sud-ovest e hinterland
            </span>
          </div>
          {/* Un H1 solo, e contiene le parole con cui questa pagina va cercata.
              Non è una concessione al motore di ricerca: è anche la frase che
              una persona deve leggere per capire in tre secondi dove è finita. */}
          <h1 className="mt-6 max-w-3xl font-display text-4xl font-black leading-[1.05] tracking-[-0.03em] md:text-6xl">
            Lavanderia a domicilio
            <br />
            a Milano. <span className="text-cyan">Il bucato esce dalla tua settimana.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/65">
            Ritiriamo il sacco sotto casa un giorno fisso a settimana, laviamo e stiriamo in
            lavanderia professionale e te lo riportiamo piegato entro 3 giorni feriali.
            Abbonamento mensile: ritiro e riconsegna sono già dentro.
          </p>
          {/* Un solo invito, come sulla home: il CAP. «Attiva WashLoop» sta
              nell'intestazione di ogni pagina, quindi metterlo anche qui
              significava due tasti che chiedono cose diverse a chi ha appena
              finito di leggere il titolo — e quello con l'impegno più grosso
              messo per primo. */}
          <div className="mt-9">
            <VerificaCap />
          </div>
          <p className="mt-6 font-display text-sm font-bold text-white/45">
            Da 160 €/mese · nessun costo di ritiro o consegna · metti in pausa quando vuoi
          </p>
          </div>

          {/* Stessa scelta della home: un solo elemento immagine, forma diversa
              sui due formati. `priority` perché è l'elemento più grande sopra
              la piega, quello su cui si misura il tempo di disegno. */}
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[24px] shadow-[var(--shadow-md)] lg:aspect-[4/5] lg:max-h-[520px]">
            <Image
              src="/borsone-bucato-pronto.webp"
              alt="Un borsone WashLoop aperto sul pavimento di casa, pieno di bucato pulito e piegato"
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </section>

      {/* ============ COME FUNZIONA ============ */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">La routine, semplificata</div>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Tre passaggi, e poi non ci pensi più.
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

      {/* ============ COSA ENTRA NEL SACCO ============ */}
      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2">
          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">Da lavare, senza pensarci</div>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">
              Tutto quello che metteresti in lavatrice.
            </h2>
            <p className="mt-4 max-w-md text-base font-medium text-white/65">
              Non è un lavasecco e non è una tintoria: è il bucato di tutti i giorni, quello che
              si accumula. Non devi dividere per colore, controllare le etichette o ricordarti
              dei delicati — quello è il nostro mestiere.
            </p>
            <p className="mt-4 max-w-md text-base font-medium text-white/65">
              I capi che vogliono il lavasecco vanno in un sacco separato: si lavorano a listino,
              fuori dal volume dell&apos;abbonamento, e il prezzo lo vedi prima.
            </p>
          </div>
          <div>
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[24px]">
              <Image
                src="/camicie-stirate-armadio.webp"
                alt="Camicie stirate e piegate su una mensola, accanto ad altre appese nell'armadio"
                fill
                loading="lazy"
                sizes="(min-width: 768px) 46vw, 100vw"
                className="object-cover object-center"
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {COSA_ENTRA.map((c) => (
                <span key={c} className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-display text-sm font-bold text-white/85">
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-5 font-display text-sm font-bold text-cyan">
              Ogni sacchetto comprende fino a 3 camicie stirate.
            </p>
          </div>
        </div>
      </section>

      {/* ============ PERCHÉ ============ */}
      <section className="bg-ice">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Cura concreta</div>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Una lavanderia costruita intorno alla tua settimana.
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

      {/* ============ DOVE PASSIAMO ============ */}
      {/* `id` perché il piè di pagina ci punta da ogni pagina del sito: la voce
          «Zone coperte» viveva su un'ancora della home, e quella sezione dalla
          home è uscita. */}
      <section id="zone" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Dove passiamo</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Milano sud-ovest, e i comuni intorno.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-muted">
            Non copriamo tutta la città, e preferiamo dirlo prima: partiamo dal quadrante
            sud-ovest, dove passiamo ogni settimana. Questi sono i quartieri e i CAP in cui il
            rider arriva oggi.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-line bg-ice p-7">
              <div className="font-display text-sm font-extrabold text-navy">A Milano</div>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted">{ZONE_SERVITE.join(" · ")}</p>
            </div>
            <div className="rounded-[24px] border border-line bg-ice p-7">
              <div className="font-display text-sm font-extrabold text-navy">Hinterland</div>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted">{COMUNI_SERVITI.join(" · ")}</p>
            </div>
          </div>
          {/* Tutti i CAP di Milano, non solo quelli del giro.
              Ritiriamo in tutta la città e la disponibilità la confermiamo al
              telefono: elencare i dieci del giro settimanale faceva credere a
              chi sta al 20147 che non lo servissimo, e quella persona chiudeva
              la pagina. I nomi dei quartieri qui sopra restano perché dicono
              da dove siamo partiti, che è un'altra informazione. */}
          <div className="mt-4 rounded-[24px] border border-line bg-white p-7">
            <div className="font-display text-sm font-extrabold text-navy">CAP di Milano città</div>
            <p className="mt-3 font-display text-sm font-bold leading-relaxed tracking-wide text-blue">
              {CAP_MILANO.join(" · ")}
            </p>
            <div className="mt-5 border-t border-line pt-4">
              <div className="font-display text-sm font-extrabold text-navy">Fuori città</div>
              <p className="mt-2 font-display text-sm font-bold tracking-wide text-blue">
                {CAP_COMUNI.join(" · ")} — {COMUNI_SERVITI.join(", ")}
              </p>
            </div>
            <p className="mt-4 text-sm font-medium text-muted">
              Il tuo non è in elenco? Scrivilo lo stesso qui sopra: decidiamo dove allargare
              guardando da dove ci scrivono.
            </p>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-ice">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Domande prima di iniziare</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Quello che serve sapere prima di affidare il bucato.
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
            Un giorno fisso.
            <br />
            Una lavatrice in meno.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg font-medium text-white/85">
            Se passiamo dalla tua zona, il sacco può entrare nella routine già dalla prossima
            settimana.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/onboarding" variant="light">Attiva WashLoop →</ButtonLink>
            <ButtonLink href="/servizio-stiro-a-domicilio-milano" variant="ghost">
              Ti serve solo lo stiro? →
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
