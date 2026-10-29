import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Bubbles } from "@/components/marketing/Bubbles";
import { JsonLd } from "@/components/marketing/JsonLd";
import { graficoPagina } from "@/lib/area-servita";
import { VerificaCap } from "@/components/lead/VerificaCap";
import { createClient } from "@/lib/supabase/server";
import { eurCents as eur } from "@/lib/format";
import { OG_IMMAGINE } from "@/lib/og";

/* ============================================================
   Come funziona, passo per passo

   Perché esiste
   -------------
   Le stesse domande arrivano ogni settimana, a voce o in chat: il sacco è mio?
   entrate in casa? come faccio se parto due settimane? cosa succede la prima
   volta? Le risposte c'erano, sparse fra la home, le due pagine di servizio e
   la testa di chi risponde al telefono.

   Questa pagina le mette in fila nell'ordine in cui capitano davvero — dalla
   scelta del servizio alla gestione di tutti i mesi dopo — così si può
   mandarla a qualcuno invece di riscriverla.

   Non è un doppione della home
   ----------------------------
   La home chiede una cosa sola (il CAP) e per questo è corta. Qui si spiega, e
   chi legge ha già deciso di capire: sono due lavori diversi, e tenerli in due
   pagine evita di rovinare quello che la home fa bene.

   I numeri vengono dal database
   -----------------------------
   Prezzi e tempi si leggono da `plans` a ogni richiesta, come in /prezzi. Un
   prezzo scritto a mano in una pagina è un prezzo che prima o poi smette di
   coincidere con quello che il checkout addebita, e l'unico modo di accorgersene
   è che se ne lamenti un cliente.
   ============================================================ */

const URL_PAGINA = "https://washloop.it/come-funziona";

export const metadata: Metadata = {
  title: "Come funziona WashLoop — dal primo ritiro in poi",
  description:
    "Come funziona WashLoop passo per passo: scegli il servizio, ricevi il tuo sacco, il ritiro ha un giorno fisso, il bucato torna lavato e stirato. Nessuno entra in casa tua.",
  alternates: { canonical: "/come-funziona" },
  openGraph: {
    title: "Come funziona WashLoop, passo per passo",
    description: "Dalla scelta del servizio alla gestione di tutti i mesi dopo: cosa succede, quando, e chi fa cosa.",
    url: URL_PAGINA,
    type: "website",
    locale: "it_IT",
    images: [OG_IMMAGINE],
  },
};

type Piano = { code: string; name: string; price_month_cents: number; turnaround_hours: number; servizio: string | null };

/** Le domande che oggi arrivano a voce. Restano in pagina perché il blocco di
 *  dati strutturati le vuole visibili: Google non accetta una FAQ che il
 *  lettore non può leggere. */
const FAQ_PAGINA = [
  {
    q: "Entrate in casa mia?",
    a: "No, mai. Lasci il sacco fuori dalla porta o lo consegni di persona al rider, come preferisci. Non abbiamo le tue chiavi, non chiediamo di lasciarle in portineria e non entriamo in casa quando non ci sei.",
  },
  {
    q: "Il sacco è mio o va restituito ogni volta?",
    a: "Il sacco con il tuo codice è tuo per tutto il tempo che sei cliente: lo ricevi all'inizio e lo riprendiamo solo se smetti. Il bucato pulito torna invece in una scatola rigida che gira: la lasci fuori vuota al ritiro successivo e il rider se la riporta.",
  },
  {
    q: "Cosa succede se parto due settimane?",
    a: "Scrivici prima di partire: mettiamo l'abbonamento in pausa, non paghi nulla per quel periodo e al rientro riparti da dove eri. La pausa non è una disdetta — il tuo sacco e i cartellini restano a casa tua.",
  },
  {
    q: "Posso saltare un ritiro senza avvisare nessuno?",
    a: "Sì: dall'app sposti o salti il ritiro della settimana quando vuoi, fino al giorno prima. Il sacco non consumato non si perde: resta a disposizione per il passaggio dopo.",
  },
  {
    q: "Come faccio a sapere dov'è il mio bucato?",
    a: "Ogni passaggio ti arriva per email e come notifica: ritirato, in lavorazione, pronto, in consegna oggi, consegnato. Nell'app vedi lo stato di ogni ordine e la data della riconsegna, che programmiamo noi e ti comunichiamo con giorno e ora.",
  },
  {
    q: "E se un capo si rovina o manca qualcosa?",
    a: "Ogni sacco è tracciato con un codice e ogni capo speciale viene fotografato. Se qualcosa non va, apri una segnalazione: la vediamo con la lavanderia e ti rispondiamo con una soluzione, non con un modulo.",
  },
];

export default async function ComeFunziona() {
  const supabase = await createClient();
  const { data: piani } = await supabase
    .from("plans")
    .select("code, name, price_month_cents, turnaround_hours, servizio")
    .eq("active", true)
    .order("sort")
    .returns<Piano[]>();

  const lavanderia = (piani ?? []).find((p) => p.servizio !== "stiro") ?? null;
  const stiro = (piani ?? []).find((p) => p.servizio === "stiro") ?? null;

  /** I dieci passi, nell'ordine in cui capitano. I primi quattro sono «la
   *  prima volta», gli altri sei sono «tutte le volte dopo»: è la divisione
   *  che fa capire quanto dura davvero la parte noiosa. */
  const PASSI: { n: string; t: string; d: string; nota?: string }[] = [
    {
      n: "01",
      t: "Scegli il servizio",
      d: lavanderia && stiro
        ? `Lava e stira a ${eur(lavanderia.price_month_cents)} al mese se vuoi liberarti di tutto, Solo stiro a ${eur(stiro.price_month_cents)} se la lavatrice la fai tu. Se non ti ci ritrovi, chiedi una soluzione su misura.`
        : "Lava e stira se vuoi liberarti di tutto, Solo stiro se la lavatrice la fai tu, oppure una soluzione su misura.",
      nota: "Nessun costo di attivazione, nessun vincolo di durata.",
    },
    {
      n: "02",
      t: "Ti registri e attivi l'abbonamento",
      d: "Nome, indirizzo, come si entra nel palazzo e la carta. Cinque minuti, e la carta la salva Stripe: noi non la vediamo mai.",
    },
    {
      n: "03",
      t: "Ti diciamo cosa aspettarti",
      d: "Ricevi un'email con il tuo codice cliente, il giorno del primo ritiro e come prepararti. Da quel momento l'app è la tua: ritiri, storico, ricevute.",
    },
    {
      n: "04",
      t: "Ti portiamo il tuo sacco",
      d: "Prima del primo ritiro passiamo a consegnarti il sacco personale e i cartellini con il tuo codice. Quel sacco resta tuo finché sei cliente.",
      nota: "È il tuo, con il tuo codice: non gira fra i clienti.",
    },
    {
      n: "05",
      t: "Lo riempi quando ti pare",
      d: "Dentro va quello che finirebbe in lavatrice: non devi dividere i colori, contare i capi o pesare niente. Si contano i sacchi, non i pezzi.",
    },
    {
      n: "06",
      t: "Il ritiro ha un giorno fisso",
      d: "Il giorno è sempre lo stesso, la fascia oraria la scegli tu. Lasci il sacco fuori dalla porta: non entriamo in casa e non teniamo chiavi. Se quella settimana non ti serve, salti il ritiro dall'app.",
    },
    {
      n: "07",
      t: "Lavoriamo i capi",
      d: lavanderia && stiro
        ? `Con Lava e stira: lavaggio, asciugatura, stiratura e piegatura in lavanderia professionale, pronto in ${lavanderia.turnaround_hours} ore. Con Solo stiro: stiratura e piega in stireria, pronto in ${stiro.turnaround_hours} ore.`
        : "Lavaggio, stiratura e piegatura in lavanderia professionale.",
    },
    {
      n: "08",
      t: "Ti riportiamo tutto piegato",
      d: "La riconsegna la programmiamo noi e ti diciamo giorno e ora. Il pulito arriva in una scatola rigida: la lasci fuori vuota al ritiro dopo e il rider se la riprende.",
    },
    {
      n: "09",
      t: "E poi si ripete, da solo",
      d: "Stesso giorno, stessa fascia, senza che tu debba prenotare ogni volta. L'unica cosa che devi ricordare è riempire il sacco.",
    },
    {
      n: "10",
      t: "Cambi idea quando vuoi",
      d: "Parti per due settimane? Mettiamo in pausa. Ti serve un ritmo diverso? Si cambia. Vuoi smettere? Si disdice senza penali, e passiamo a riprenderci sacco e cartellini.",
    },
  ];

  const DISTINTIVI = [
    { t: "Il sacco è tuo", d: "Con il tuo codice, consegnato all'inizio e ripreso solo se smetti. Non gira fra i clienti." },
    { t: "Non entriamo in casa", d: "Il sacco si lascia fuori dalla porta o si consegna a mano. Non chiediamo chiavi e non entriamo mai." },
    { t: "È un abbonamento, non un carrello", d: "Il prezzo del mese lo sai prima. Nessun conteggio di capi a fine mese, nessuna sorpresa." },
    { t: "Ogni passaggio è tracciato", d: "Il sacco ha un QR che il rider scansiona a ritiro e consegna: in ogni momento si sa dov'è." },
  ];

  return (
    <>
      <JsonLd
        data={graficoPagina({
          nomeServizio: "Come funziona il servizio WashLoop",
          descrizione:
            "Il percorso completo del cliente WashLoop: scelta del servizio, attivazione, consegna del sacco personale, ritiro a giorno fisso, lavorazione e riconsegna.",
          url: URL_PAGINA,
          faq: FAQ_PAGINA,
        })}
      />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto max-w-4xl px-5 py-16 text-center md:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan" />
            <span className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-cyan">
              Dalla prima volta in poi
            </span>
          </div>
          <h1 className="mt-6 font-display text-4xl font-black leading-[1.05] tracking-[-0.03em] md:text-6xl">
            Come funziona,
            <br />
            <span className="text-cyan">senza giri di parole.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-white/65">
            Dieci passi: i primi quattro succedono una volta sola, gli altri si ripetono da soli. In fondo
            trovi le domande che ci fanno più spesso.
          </p>
          <div className="mx-auto mt-9 max-w-xl text-left">
            <VerificaCap />
          </div>
        </div>
      </section>

      {/* ============ LA PRIMA VOLTA ============ */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">La prima volta</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Quattro passi, e poi non ci pensi più.
          </h2>

          <ol className="mt-12 space-y-5">
            {PASSI.slice(0, 4).map((s) => (
              <li key={s.n} className="flex gap-5 rounded-[24px] border border-line bg-ice p-6 md:p-7">
                <span className="font-display text-2xl font-black text-cyan">{s.n}</span>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-navy">{s.t}</h3>
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted">{s.d}</p>
                  {s.nota && <p className="mt-2 font-display text-xs font-bold text-blue">{s.nota}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ TUTTE LE VOLTE DOPO ============ */}
      <section className="bg-ice">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Tutte le volte dopo</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Il giro che si ripete da solo.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-muted">
            Da qui in avanti l&apos;unica cosa che devi ricordare è riempire il sacco. Al resto — giorno,
            orario, lavorazione, riconsegna — pensiamo noi.
          </p>

          <ol className="mt-12 grid gap-5 md:grid-cols-2">
            {PASSI.slice(4).map((s) => (
              <li key={s.n} className="rounded-[24px] border border-line bg-white p-6 md:p-7">
                <span className="font-display text-2xl font-black text-cyan">{s.n}</span>
                <h3 className="mt-3 font-display text-lg font-extrabold text-navy">{s.t}</h3>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted">{s.d}</p>
                {s.nota && <p className="mt-2 font-display text-xs font-bold text-blue">{s.nota}</p>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ COSA CI DISTINGUE ============ */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">Quattro cose da sapere</div>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">
            Le regole della casa.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {DISTINTIVI.map((d) => (
              <div key={d.t} className="rounded-[24px] border border-white/15 bg-white/[0.06] p-7">
                <h3 className="font-display text-lg font-extrabold text-white">{d.t}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-white/65">{d.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Le domande vere</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Quelle che ci fate davvero.
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

      {/* ============ CTA ============ */}
      <section className="bg-grad">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center text-white">
          <h2 className="font-display text-3xl font-black tracking-[-0.02em] md:text-5xl">
            Adesso sai tutto.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg font-medium text-white/85">
            Se passiamo dalla tua zona, il primo sacco può partire la settimana prossima.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/onboarding" variant="light">Attiva WashLoop →</ButtonLink>
            <ButtonLink href="/prezzi" variant="ghost">Vedi i prezzi →</ButtonLink>
          </div>
          <p className="mt-6 text-sm font-medium text-white/70">
            Hai un caso particolare?{" "}
            <Link href="/prezzi#su-misura" className="font-bold underline">Chiedi una soluzione su misura</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
