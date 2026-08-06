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
  { t: "Professionista", icon: "work", d: "Per chi vuole proteggere il tempo fuori dall'ufficio senza sacrificare la cura del guardaroba." },
  { t: "Famiglia", icon: "family", d: "Per chi desidera alleggerire una delle incombenze più ricorrenti della settimana." },
  { t: "Lifestyle", icon: "spark", d: "Per chi cerca una routine curata, flessibile e allineata a uno standard di vita più semplice." },
] as const;

const numbers = [
  { n: "1", d: "giorno fisso di ritiro scelto da te" },
  { n: "3", d: "giorni feriali massimi per la riconsegna" },
  { n: "3", d: "piani per adattare il servizio al tuo volume" },
];

const guaranteePoints = [
  { t: "Ritiro nel giorno scelto", icon: "clock" },
  { t: "Lavaggio e stiraggio professionali", icon: "box" },
  { t: "Flessibilità per la tua agenda", icon: "pause" },
] as const;

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
    q: "Quali zone coprite?",
    a: "Stiamo partendo dal centro e dai quartieri semicentrali di Milano, più l'hinterland sud-ovest: Assago, Buccinasco e Rozzano. Inserisci il tuo CAP: ti diciamo subito se sei in zona o ti avvisiamo all'apertura.",
  },
];

function GuaranteeIcon({ kind }: { kind: (typeof guarantees)[number]["icon"] }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "pause") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></svg>;
  if (kind === "truck") return <svg {...common}><path d="M3 16V6h11v10" /><path d="M14 9h4l3 3v4h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12.5 11 15.5 16 9.5" /></svg>;
}

function ProfileIcon({ kind }: { kind: (typeof profiles)[number]["icon"] }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "family") return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><path d="M16.5 11a2.5 2.5 0 1 0 0-5" /><path d="M17 20c0-2.2-.7-3.7-2-4.6" /></svg>;
  if (kind === "spark") return <svg {...common}><path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9 12 3.5Z" /><path d="M18.5 16.5 19.3 19l2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.5Z" /></svg>;
  return <svg {...common}><rect x="3" y="7.5" width="18" height="12" rx="2.5" /><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" /><path d="M3 13h18" /></svg>;
}

function GuaranteeRowIcon({ kind }: { kind: (typeof guaranteePoints)[number]["icon"] }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "box") return <svg {...common}><path d="M12 3 20.5 7.5v9L12 21l-8.5-4.5v-9L12 3Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></svg>;
  if (kind === "pause") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

/** Visual della sezione Garanzia: aloni concentrici e un blob navy con lo scudo.
 *  Tutto in markup, nessuna immagine da gestire. */
function ShieldBlob() {
  return (
    <div className="flex justify-center" aria-hidden>
      <div className="relative flex h-[300px] w-[300px] items-center justify-center md:h-[360px] md:w-[360px]">
        <span className="absolute inset-0 rounded-full border border-cyan/20 bg-cyan/[0.04]" />
        <span className="absolute inset-[14%] rounded-full bg-cyan/[0.07]" />
        <span
          className="relative flex h-[58%] w-[58%] items-center justify-center bg-navy shadow-[0_30px_60px_-20px_rgba(27,45,94,.45)]"
          style={{ borderRadius: "42% 58% 46% 54% / 52% 44% 56% 48%" }}
        >
          <svg width="44%" height="44%" viewBox="0 0 24 24" fill="none" stroke="#00c8f0" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.2 19.2 6v6.1c0 4.3-2.9 7.4-7.2 8.7-4.3-1.3-7.2-4.4-7.2-8.7V6L12 3.2Z" />
            <path d="M9 12.2 11.2 14.5 15.3 10.2" />
          </svg>
        </span>
      </div>
    </div>
  );
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
      {/* Fondo ice come la sezione sotto: con `bg-white` restava una banda
          bianca sotto la barra e lo stacco si vedeva.
          `relative z-10`: l'hero è posizionato, quindi senza questo verrebbe
          disegnato sopra la barra e la taglierebbe a metà. */}
      <section className="relative z-10 bg-ice">
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
      <section className="bg-ice">
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
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">Una routine in quattro gesti</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">Come funziona</h2>
          <p className="mt-3 max-w-xl text-base font-medium text-white/60">
            Nessuna corsa, nessuna chat da gestire, nessun promemoria da impostare ogni settimana.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.n} className="relative rounded-[24px] border border-white/10 bg-navy-hi/40 p-7">
                {/* filo che lega uno step al successivo: la routine è una sequenza */}
                {i < steps.length - 1 && (
                  <span className="pointer-events-none absolute left-full top-1/2 hidden h-px w-6 bg-white/15 md:block" aria-hidden />
                )}
                <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-[12px] bg-cyan px-2 font-display text-sm font-black text-navy">
                  {s.n}
                </span>
                <h3 className="mt-5 font-display text-lg font-extrabold">{s.t}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-white/60">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PROFILI + NUMERI ============ */}
      <section className="bg-ice">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-[1.05fr_.95fr] md:items-center">
          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Pensato per la tua realtà</div>
            <h2 className="mt-3 font-display text-3xl font-black leading-[1.1] tracking-[-0.02em] text-navy md:text-4xl">
              Il servizio cambia. Il tuo tempo no.
            </h2>
            <p className="mt-3 max-w-lg text-base font-medium text-muted">
              Abbiamo progettato ogni dettaglio per alleggerire una routine ricorrente, senza rinunciare alla cura dei capi.
            </p>

            <div className="mt-8 space-y-4">
              {profiles.map((p) => (
                <article key={p.t} className="flex gap-4 rounded-[20px] bg-white p-5 shadow-[var(--shadow-sm)]">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-cyan/15 text-blue" aria-hidden>
                    <ProfileIcon kind={p.icon} />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-extrabold text-navy">{p.t}</h3>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{p.d}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Fiducia, in numeri chiari — pannello navy con la CTA dentro */}
          <aside aria-label="Indicatori di affidabilità del servizio" className="relative overflow-hidden rounded-[24px] bg-navy p-8 text-white shadow-[var(--shadow-md)]">
            <span className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan/15 blur-3xl" aria-hidden />
            <div className="relative">
              <h3 className="font-display text-2xl font-black tracking-[-0.02em]">Fiducia, in numeri chiari.</h3>
              <dl className="mt-7 space-y-5">
                {numbers.map((n) => (
                  <div key={n.d} className="flex items-baseline gap-5">
                    <dt className="w-8 flex-none font-display text-3xl font-black leading-none text-cyan">{n.n}</dt>
                    <dd className="font-display text-sm font-bold leading-snug text-white/70">{n.d}</dd>
                  </div>
                ))}
              </dl>
              <a
                href="#richiesta"
                className="mt-8 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[40px] bg-cyan px-6 font-display text-base font-extrabold text-navy transition-transform hover:-translate-y-0.5"
              >
                Verifica disponibilità →
              </a>
            </div>
          </aside>
        </div>
      </section>

      {/* ============ GARANZIA WASHLOOP ============ */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-2 md:items-center">
          <ShieldBlob />
          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">La Garanzia WashLoop</div>
            <h2 className="mt-3 font-display text-3xl font-black leading-[1.1] tracking-[-0.02em] text-navy md:text-4xl">
              Una routine chiara, dalla porta di casa al tuo armadio.
            </h2>
            <p className="mt-4 max-w-lg text-base font-medium leading-relaxed text-muted">
              WashLoop nasce per togliere incertezza alla gestione dei capi: un giorno concordato, una cura professionale e una riconsegna entro il terzo giorno feriale.
            </p>
            <ul className="mt-8 space-y-4">
              {guaranteePoints.map((g) => (
                <li key={g.t} className="flex items-center gap-3 font-display text-base font-extrabold text-navy">
                  <span className="flex-none text-cyan" aria-hidden><GuaranteeRowIcon kind={g.icon} /></span>
                  {g.t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      {/* Ritmo dei fondi come nel riferimento: ice → navy → ice → bianco → ice →
          navy. Due sezioni bianche di fila appiattirebbero la pagina. */}
      <section className="bg-ice">
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
          <div>
            {faqs.map((f) => (
              <details key={f.q} className="group border-b border-line py-5 first:border-t">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-extrabold text-navy">
                  {f.q}
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="flex-none text-navy/40 transition-transform group-open:rotate-180" aria-hidden>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-muted">{f.a}</p>
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
