import type { Metadata } from "next";
import { LeadProvider } from "@/components/landing/LeadContext";
import { CapHeroForm } from "@/components/landing/CapHeroForm";
import { PlanCards } from "@/components/landing/PlanCards";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { LeadForm } from "@/components/landing/LeadForm";

/* ============================================================
   Landing "Verifica disponibilità" — pagina per campagne a pagamento.
   Raccoglie lead, NON vende: nessun prezzo, nessun link al checkout.
   Copy dalla creatività approvata; stile e token dal sito principale.
   ============================================================ */

export const metadata: Metadata = {
  title: "Verifica la disponibilità a Milano",
  description:
    "Scopri se WashLoop copre il tuo CAP a Milano. Lascia i tuoi dati: verifichiamo la disponibilità nella tua zona e ti ricontattiamo.",
  // Landing per traffico a pagamento: duplica i contenuti della home e non deve
  // competere in organico. Solo noindex — niente Disallow in robots.txt, o il
  // crawler non leggerebbe mai questo meta.
  robots: { index: false, follow: false },
  alternates: { canonical: "/disponibilita" },
};

function Bubbles() {
  const b = [
    { w: 320, r: -60, t: -80, o: 0.12, d: "0s" },
    { w: 180, r: 200, t: 60, o: 0.09, d: "1.5s" },
    { w: 90, r: 160, t: 240, o: 0.11, d: "0.8s" },
    { w: 60, l: 80, b: 120, o: 0.1, d: "2.2s" },
    { w: 200, l: -50, b: -60, o: 0.07, d: "1s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {b.map((x, i) => (
        <span
          key={i}
          className="wl-bubble"
          style={{ width: x.w, height: x.w, right: x.r, left: x.l, top: x.t, bottom: x.b, opacity: x.o, animationDelay: x.d }}
        />
      ))}
    </div>
  );
}

const guarantees = [
  { t: "Nessun contratto", icon: "check" },
  { t: "Metti in pausa quando vuoi", icon: "pause" },
  { t: "Ritiriamo e consegniamo noi", icon: "truck" },
] as const;

const steps = [
  { n: "01", t: "Riempi il sacco", d: "Raccogli i capi della settimana nel tuo sacco WashLoop." },
  { n: "02", t: "Ritiriamo", d: "Passiamo nel giorno fisso che hai scelto, senza dover prenotare ogni volta." },
  { n: "03", t: "Ci prendiamo cura dei capi", d: "Lavaggio e stiraggio professionali, con la fragranza che preferisci." },
  { n: "04", t: "Pronti da indossare", d: "Riconsegniamo i tuoi capi entro il terzo giorno feriale." },
];

const profiles = [
  { t: "Professionista", d: "Per chi vuole proteggere il tempo fuori dall'ufficio senza sacrificare la cura del guardaroba." },
  { t: "Famiglia", d: "Per chi desidera alleggerire una delle incombenze più ricorrenti della settimana." },
  { t: "Lifestyle", d: "Per chi cerca una routine curata, flessibile e allineata a uno standard di vita più semplice." },
];

const numbers = [
  { n: "1", d: "giorno fisso di ritiro scelto da te" },
  { n: "3", d: "giorni feriali massimi per la riconsegna" },
  { n: "3", d: "piani per adattare il servizio al tuo volume" },
];

const guaranteePoints = ["Ritiro nel giorno scelto", "Lavaggio e stiraggio professionali", "Flessibilità per la tua agenda"];

// Risposte dal copy già pubblicato su washloop.it (nessun testo inventato).
const faqs = [
  {
    q: "Posso mettere in pausa il servizio?",
    a: "Sì. Vai in vacanza? Metti in pausa per un mese intero dall'app, e lo riprendi quando vuoi. Paghi solo quando usi davvero il servizio.",
  },
  {
    q: "Posso scegliere il giorno fisso di ritiro?",
    a: "Sì: scegli tu il giorno. Passiamo nel giorno fisso che hai scelto, senza dover prenotare ogni volta.",
  },
  {
    q: "Quanti sacchi e ritiri sono inclusi?",
    a: "Dipende dal piano: S 1 sacco a settimana, M 2, L 3. Il ritiro è sempre una volta a settimana. Ogni sacchetto contiene fino a 3 camicie.",
  },
  {
    q: "Quali zone coprite a Milano?",
    a: "Stiamo partendo dal centro e dai quartieri semicentrali di Milano. Inserisci il tuo CAP: ti diciamo subito se sei in zona o ti avvisiamo all'apertura.",
  },
];

function GuaranteeIcon({ kind }: { kind: (typeof guarantees)[number]["icon"] }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "pause") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></svg>;
  if (kind === "truck") return <svg {...common}><path d="M3 16V6h11v10" /><path d="M14 9h4l3 3v4h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12.5 11 15.5 16 9.5" /></svg>;
}

export default async function DisponibilitaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const utm = { source: one("utm_source"), medium: one("utm_medium"), campaign: one("utm_campaign") };

  return (
    <LeadProvider>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 md:grid-cols-[1.05fr_.95fr] md:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan" />
              <span className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-cyan">
                Lavanderia in abbonamento a Milano
              </span>
            </div>
            <h1 className="mt-6 font-display text-5xl font-black leading-[1.05] tracking-[-0.02em] md:text-6xl">
              Smetti di fare il bucato. <span className="text-grad">Inizia a vivere.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/65">
              Scegli il tuo giorno fisso di ritiro. Noi laviamo, stiriamo e riconsegniamo i tuoi capi entro 3 giorni.
            </p>
            <CapHeroForm />
          </div>
          <div className="md:pb-6">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ============ GARANZIE ============ */}
      <section className="bg-white">
        <div className="mx-auto -mt-8 max-w-5xl px-5">
          <div className="grid gap-px overflow-hidden rounded-[24px] border border-line bg-line shadow-[var(--shadow-md)] sm:grid-cols-3">
            {guarantees.map((g) => (
              <div key={g.t} className="flex items-center justify-center gap-2.5 bg-white px-5 py-5 text-center">
                <span className="text-[#1F8A5B]"><GuaranteeIcon kind={g.icon} /></span>
                <span className="font-display text-sm font-extrabold text-navy">{g.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PIANI (senza prezzi) ============ */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="text-center">
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Un piano, ogni settimana</div>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
              Il tuo bucato ha trovato la sua routine.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base font-medium text-muted">
              Scegli il volume giusto per te. Una volta scelto il piano, il resto diventa semplice: stesso giorno di ritiro, stessa cura, più tempo per te.
            </p>
          </div>
          <PlanCards />
        </div>
      </section>

      {/* ============ COME FUNZIONA ============ */}
      <section className="bg-ice">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Una routine in quattro gesti</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">Come funziona</h2>
          <p className="mt-3 max-w-xl text-base font-medium text-muted">
            Nessuna corsa, nessuna chat da gestire, nessun promemoria da impostare ogni settimana.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="rounded-[24px] border border-line bg-white p-7">
                <div className="font-display text-3xl font-black text-cyan">{s.n}</div>
                <h3 className="mt-4 font-display text-lg font-extrabold text-navy">{s.t}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PROFILI + NUMERI ============ */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Pensato per la tua realtà</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Il servizio cambia. Il tuo tempo no.
          </h2>
          <p className="mt-3 max-w-xl text-base font-medium text-muted">
            Abbiamo progettato ogni dettaglio per alleggerire una routine ricorrente, senza rinunciare alla cura dei capi.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {profiles.map((p) => (
              <article key={p.t} className="rounded-[24px] border border-line bg-ice p-7">
                <h3 className="font-display text-lg font-extrabold text-navy">{p.t}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{p.d}</p>
              </article>
            ))}
          </div>

          <aside aria-label="Indicatori di affidabilità del servizio" className="mt-10 rounded-[24px] bg-navy px-7 py-10 text-white">
            <h3 className="font-display text-2xl font-black tracking-[-0.02em]">Fiducia, in numeri chiari.</h3>
            <div className="mt-7 grid gap-7 sm:grid-cols-3">
              {numbers.map((n) => (
                <div key={n.d}>
                  <div className="font-display text-5xl font-black leading-none text-cyan">{n.n}</div>
                  <p className="mt-2 text-sm font-medium text-white/60">{n.d}</p>
                </div>
              ))}
            </div>
            <a
              href="#richiesta"
              className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-[40px] bg-white px-6 font-display text-[15px] font-extrabold text-navy transition-transform hover:-translate-y-0.5"
            >
              Verifica disponibilità →
            </a>
          </aside>
        </div>
      </section>

      {/* ============ GARANZIA WASHLOOP ============ */}
      <section className="bg-ice">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2 md:items-center">
          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">La Garanzia WashLoop</div>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
              Una routine chiara, dalla porta di casa al tuo armadio.
            </h2>
            <p className="mt-4 text-base font-medium leading-relaxed text-muted">
              WashLoop nasce per togliere incertezza alla gestione dei capi: un giorno concordato, una cura professionale e una riconsegna entro il terzo giorno feriale.
            </p>
          </div>
          <ul className="space-y-3">
            {guaranteePoints.map((g) => (
              <li key={g} className="flex items-center gap-3 rounded-[18px] border border-line bg-white px-5 py-4 font-display text-base font-extrabold text-navy">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-cyan/15 text-blue">
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 9.5 18 20 6.5" /></svg>
                </span>
                {g}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Tutto chiaro, fin da subito</div>
            <h2 className="mt-3 font-display text-3xl font-black leading-[1.1] tracking-[-0.02em] text-navy md:text-4xl">
              Le domande che contano prima di iniziare.
            </h2>
            <p className="mt-4 text-base font-medium text-muted">
              Abbiamo reso semplici anche i dettagli, così puoi decidere con consapevolezza.
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-[18px] border border-line bg-ice p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-extrabold text-navy">
                  {f.q}
                  <span className="text-cyan transition-transform group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm font-medium leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FORM ============ */}
      <section id="richiesta" className="scroll-mt-20 bg-navy text-white">
        <div className="relative overflow-hidden">
          <Bubbles />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2 md:items-center">
            <div>
              <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">Milano, iniziamo da qui</div>
              <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">
                Scopri se WashLoop è disponibile per te.
              </h2>
              <p className="mt-4 max-w-md text-base font-medium leading-relaxed text-white/65">
                Lascia i tuoi dati e il piano che preferisci. Il team WashLoop verificherà la disponibilità nella tua zona e ti ricontatterà.
              </p>
              <p className="mt-8 font-display text-lg font-extrabold text-white">La tua routine sta per cambiare.</p>
              <p className="mt-2 max-w-md text-sm font-medium text-white/55">
                Compila il modulo: bastano pochi secondi.
              </p>
            </div>
            <LeadForm utm={utm} />
          </div>
        </div>
      </section>
    </LeadProvider>
  );
}
