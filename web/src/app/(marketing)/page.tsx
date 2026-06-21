import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ButtonLink } from "@/components/ui/Button";

/* ============================================================
   Home — Sito vetrina WashLoop
   Tone of voice da Brandbook: tu, premium, tempo guadagnato,
   urgenza reale, mai low-cost.
   ============================================================ */

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
          style={{
            width: x.w,
            height: x.w,
            right: x.r,
            left: x.l,
            top: x.t,
            bottom: x.b,
            opacity: x.o,
            animationDelay: x.d,
          }}
        />
      ))}
    </div>
  );
}

const steps = [
  { n: "01", t: "Scegli il piano", d: "Attivi l'abbonamento in 2 minuti. Nessun costo nascosto, nessun vincolo lungo." },
  { n: "02", t: "Prenoti il ritiro", d: "Scegli giorno e fascia oraria dall'app. Il corriere passa da te, sotto casa." },
  { n: "03", t: "Laviamo e stiriamo", d: "Lavanderia professionale. Ogni capo trattato e tracciato, passo dopo passo." },
  { n: "04", t: "Ricevi tutto a casa", d: "Prenoti la consegna quando vuoi. Guardaroba pronto, piegato e stirato." },
];

const compare = [
  { f: "Prezzo chiaro in anticipo", wl: true, others: false },
  { f: "Tempi di consegna garantiti", wl: true, others: false },
  { f: "Tracciabilità capo per capo", wl: true, others: false },
  { f: "Ritiro e consegna a domicilio", wl: true, others: true },
  { f: "Policy danni trasparente", wl: true, others: false },
  { f: "App con stato in tempo reale", wl: true, others: true },
];

const plans = [
  {
    name: "Small",
    code: "essential",
    price: "160",
    tagline: "Per chi vive da solo",
    features: ["1 sacco a settimana", "Ritiro 1 volta a settimana", "Fino a 3 camicie per sacchetto", "Lavaggio + stiratura inclusi", "Metti in pausa quando vuoi"],
    popular: false,
  },
  {
    name: "Medium",
    code: "plus",
    price: "280",
    tagline: "Il preferito dei professionisti",
    features: ["2 sacchi a settimana", "Ritiro 1 volta a settimana", "Cumuli i sacchi nel mese", "Lavaggio + stiratura premium", "Tracciabilità capo per capo"],
    popular: true,
  },
  {
    name: "Large",
    code: "family",
    price: "390",
    tagline: "Per coppie e famiglie",
    features: ["3 sacchi a settimana", "Ritiro 1 volta a settimana", "Cumuli i sacchi nel mese", "Capi delicati inclusi", "Slot prioritari"],
    popular: false,
  },
];

const faqs = [
  { q: "Quanti sacchi e ritiri sono inclusi?", a: "Dipende dal piano: Small 1 sacco a settimana, Medium 2, Large 3. Il ritiro è sempre una volta a settimana. Ogni sacchetto contiene fino a 3 camicie." },
  { q: "Posso consegnare più sacchi insieme?", a: "Sì. Puoi cumulare i sacchi del tuo abbonamento nell'arco del mese: se una settimana non consegni, la successiva porti due sacchi insieme. Basta avvisare il driver il giorno prima." },
  { q: "Mi serve un sacco extra. Quanto costa?", a: "Puoi aggiungere sacchi oltre quelli del piano a €45 l'uno. Li gestisci direttamente dall'app." },
  { q: "E i capi da lavanderia o delicati?", a: "Mettili in un sacco separato apposito: li lavoriamo a prezzo di listino, fuori dal volume dell'abbonamento." },
  { q: "Posso mettere in pausa l'abbonamento?", a: "Sì. Vai in vacanza? Metti in pausa per un mese intero dall'app, e lo riprendi quando vuoi. Paghi solo quando usi davvero il servizio." },
  { q: "Cosa succede se un capo si rovina?", a: "Abbiamo una policy danni trasparente: ogni capo è tracciato e fotografato. In caso di problema ti rimborsiamo secondo termini chiari, scritti nero su bianco." },
  { q: "Quali zone coprite a Milano?", a: "Stiamo partendo dal centro e dai quartieri semicentrali di Milano. Inserisci il tuo indirizzo: ti diciamo subito se sei in zona o ti avvisiamo all'apertura." },
];

export default function Home() {
  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan" />
            <span className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-cyan">
              Lista d&apos;attesa · Milano 2026
            </span>
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-black leading-[1.05] tracking-[-0.02em] md:text-6xl">
            Smetti di fare il bucato.
            <br />
            <span className="text-grad">Inizia a vivere.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/65">
            Ritiriamo, laviamo, stiriamo e ti riconsegniamo il guardaroba a casa. Tutto dal telefono. Zero pensieri.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/#prezzi">Attiva WashLoop →</ButtonLink>
            <ButtonLink href="https://funnel.washloop.it" variant="ghost">
              Scopri il tuo profilo bucato →
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm font-semibold text-white/45">
            60 secondi · scopri quante ore ti ridiamo indietro
          </p>
          <p className="mt-10 font-display text-sm font-bold text-white/55">
            <span className="text-cyan">2.347 persone</span> hanno già prenotato il posto
          </p>
        </div>
      </section>

      {/* ============ COMPARATIVA vs concorrenza ============ */}
      <section className="bg-ice">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="text-center">
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Perché WashLoop</div>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
              Tutto chiaro. Niente sorprese.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base font-medium text-muted">
              Gli altri nascondono prezzi e tempi. Noi li scriviamo nero su bianco.
            </p>
          </div>
          <div className="mt-10 overflow-hidden rounded-[24px] border border-line bg-white shadow-[var(--shadow-sm)]">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line bg-navy px-6 py-4 text-white">
              <div className="font-display text-sm font-extrabold">Cosa conta davvero</div>
              <div className="w-20 text-center font-display text-sm font-extrabold text-cyan">WashLoop</div>
              <div className="w-20 text-center font-display text-xs font-bold text-white/50">Gli altri</div>
            </div>
            {compare.map((row) => (
              <div key={row.f} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line px-6 py-4 last:border-0">
                <div className="text-sm font-semibold text-navy">{row.f}</div>
                <div className="w-20 text-center text-lg font-black text-[#1F8A5B]">✓</div>
                <div className="w-20 text-center text-lg font-black text-[#C0392B]">{row.others ? <span className="text-[#1F8A5B]">✓</span> : "✕"}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COME FUNZIONA ============ */}
      <section id="come-funziona" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Come funziona</div>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Quattro passi. Il tuo tempo, indietro.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="rounded-[24px] border border-line bg-ice p-7">
                <div className="font-display text-3xl font-black text-cyan">{s.n}</div>
                <h3 className="mt-4 font-display text-lg font-extrabold text-navy">{s.t}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PREZZI ============ */}
      <section id="prezzi" className="scroll-mt-20 bg-ice">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1.5">
              <span className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-blue">
                Prezzo Founder bloccato — ne restano 137
              </span>
            </div>
            <h2 className="mt-5 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
              Scegli il tuo piano
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base font-medium text-muted">
              Blocchi ora il prezzo Founder per sempre. Niente costi di ritiro e consegna: già tutto incluso.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={
                  p.popular
                    ? "relative rounded-[24px] bg-navy p-8 text-white shadow-[var(--shadow-md)]"
                    : "relative rounded-[24px] border border-line bg-white p-8"
                }
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-grad px-3 py-1 font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-white">
                    Più scelto
                  </div>
                )}
                <h3 className={`font-display text-xl font-black ${p.popular ? "text-white" : "text-navy"}`}>{p.name}</h3>
                <p className={`mt-1 text-sm font-semibold ${p.popular ? "text-white/55" : "text-muted"}`}>{p.tagline}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className={`font-display text-5xl font-black ${p.popular ? "text-white" : "text-navy"}`}>€{p.price}</span>
                  <span className={`mb-1.5 text-sm font-semibold ${p.popular ? "text-white/55" : "text-muted"}`}>/mese</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-sm font-medium ${p.popular ? "text-white/80" : "text-navy/80"}`}>
                      <span className="mt-0.5 font-black text-cyan">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href={`/onboarding?plan=${p.code}`}
                  variant={p.popular ? "light" : "primary"}
                  className="mt-8 w-full"
                >
                  Attiva {p.name} →
                </ButtonLink>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm font-medium text-muted">
            Ogni sacchetto contiene fino a 3 camicie. Sacchi extra a €45 l&apos;uno. I capi da lavanderia (in un sacco separato) si lavorano a prezzo di listino. Metti in pausa e riprendi quando vuoi.
          </p>
        </div>
      </section>

      {/* ============ AREA COPERTA ============ */}
      <section id="area" className="scroll-mt-20 bg-navy text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2">
          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">Dove siamo</div>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">
              Partiamo da Milano.
            </h2>
            <p className="mt-4 max-w-md text-base font-medium text-white/65">
              Partiamo dal centro di Milano. Inserisci il tuo indirizzo quando attivi: ti diciamo subito se sei in zona, o ti avvisiamo appena apriamo da te.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-10 text-center">
            <Logo variant="white" size={44} />
            <p className="mt-6 font-display text-lg font-extrabold leading-snug">
              Tutto dal telefono.
              <br />
              <span className="text-cyan">Zero pensieri.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="text-center">
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Domande frequenti</div>
            <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
              Tutto quello che vuoi sapere
            </h2>
          </div>
          <div className="mt-10 space-y-3">
            {faqs.map((f) => (
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

      {/* ============ CTA FINALE ============ */}
      <section className="bg-grad">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center text-white">
          <h2 className="font-display text-3xl font-black tracking-[-0.02em] md:text-5xl">
            Questo non è un lusso.
            <br />È il tuo nuovo standard.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg font-medium text-white/85">
            Il tuo tempo vale troppo per il bucato. Delegalo a chi lo fa meglio di te.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/#prezzi" variant="light">
              Attiva WashLoop →
            </ButtonLink>
            <ButtonLink href="https://funnel.washloop.it" variant="ghost">
              Scopri il tuo profilo bucato →
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm font-semibold text-white/70">
            <Link href="/login" className="underline">
              Hai già un account? Accedi
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
