import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Bubbles } from "@/components/marketing/Bubbles";
import { JsonLd } from "@/components/marketing/JsonLd";
import { graficoPagina } from "@/lib/area-servita";
import { VerificaCap } from "@/components/lead/VerificaCap";
import { createClient } from "@/lib/supabase/server";
import { eurCents as eur } from "@/lib/format";

/* ============================================================
   Pagina prezzi

   Perché esiste
   -------------
   Il prezzo si vedeva solo dentro l'onboarding, cioè **dopo** che uno aveva
   deciso di registrarsi. Chi cerca «quanto costa» prima di dare la mail non
   trovava niente e se ne andava, e la domanda arrivava comunque — al telefono,
   una per volta.

   I numeri vengono dal database, non da qui
   -----------------------------------------
   Piani e listino si leggono a ogni richiesta dalle stesse tabelle che usa
   l'onboarding. Un prezzo scritto a mano in una pagina di marketing è un prezzo
   che prima o poi smette di coincidere con quello che l'app addebita, e l'unico
   modo di accorgersene è che se ne lamenti un cliente.

   Il listino passa dalla vista `special_items_public`, che espone i soli capi
   attivi **senza** il compenso alla lavanderia: non c'è modo di pubblicare per
   sbaglio quanto paghiamo noi.
   ============================================================ */

const URL_PAGINA = "https://washloop.it/prezzi";

export const metadata: Metadata = {
  title: "Prezzi e piani — WashLoop lavanderia a domicilio a Milano",
  description:
    "Quanto costa WashLoop: tre piani in abbonamento da 160 €/mese, con ritiro, lavaggio, stiratura e riconsegna inclusi. Il listino dei capi fuori abbonamento, pubblicato per intero.",
  alternates: { canonical: "/prezzi" },
  openGraph: {
    title: "Prezzi e piani — WashLoop",
    description: "Tre piani, un unico importo mensile. Ritiro, lavaggio, stiratura e riconsegna sono già dentro.",
    url: URL_PAGINA,
    type: "website",
    locale: "it_IT",
  },
};

/** Il sacco extra non è nel listino dei capi: è una voce dell'abbonamento, e
 *  sta scritta nelle FAQ dell'area cliente. Un solo numero, preso da lì. */
const SACCO_EXTRA_CENTS = 4500;

/** Quante settimane si contano in un mese per dire «a settimana».
 *
 *  Quattro, non 4,33: il ritiro è settimanale e in un mese se ne fanno quattro.
 *  Dividere per la media reale darebbe un numero più preciso e più falso —
 *  direbbe un prezzo a sacco che nessun mese produce davvero. */
const SETTIMANE_AL_MESE = 4;

const PILASTRI = [
  { t: "Ritiro e riconsegna inclusi", d: "Mai un costo di trasporto, sotto casa." },
  { t: "Stiratura inclusa", d: "Nessun supplemento a capo, mai." },
  { t: "Pausa quando vuoi", d: "Un mese intero dall'app, senza pagare." },
  { t: "Nessun vincolo di durata", d: "Nessuna attivazione, nessuna penale." },
];

/** Il testo delle tre card, per codice piano. Sta qui e non in `PLAN_COPY`
 *  perché lì le voci servono al recap di una riga sola dell'onboarding: qui
 *  servono a far scegliere, e parlano di persone invece che di funzioni. */
const CARD: Record<string, { per: string; righe: (b: number) => string[]; evidenza?: string }> = {
  essential: {
    per: "Per una persona, o per una coppia che non cucina in casa.",
    righe: (b) => [
      `${b * SETTIMANE_AL_MESE} ritiri e ${b * SETTIMANE_AL_MESE} riconsegne al mese`,
      "Lavaggio e stiratura di tutto il contenuto",
      `Fino a ${b * 3} camicie stirate a settimana`,
      "Giorno fisso e fascia oraria a scelta",
      "Pausa mensile dall'app",
    ],
  },
  plus: {
    per: "Il piano per una famiglia di 3 o 4 persone.",
    righe: (b) => [
      `${b} sacchi nello stesso giorno fisso`,
      "Tutto quello che è incluso in Small",
      `Fino a ${b * 3} camicie stirate a settimana`,
      "Lenzuola e biancheria di casa senza accumuli",
      "Pausa mensile dall'app",
    ],
    evidenza: "Il piano scelto da 7 clienti su 10",
  },
  family: {
    per: "Famiglie numerose, casa con ospiti, chi vuole margine.",
    righe: (b) => [
      `${b} sacchi nello stesso giorno fisso`,
      "Tutto quello che è incluso in Small",
      `Fino a ${b * 3} camicie stirate a settimana`,
      "Il prezzo per sacco più basso del listino",
      "Pausa mensile dall'app",
    ],
  },
};

const COMPRESO = [
  "Ritiro sotto casa nel giorno fisso, con sacco tracciato",
  "Lavaggio in lavanderia professionale, con separazione a carico nostro",
  "Stiratura dei capi che la richiedono — camicie, camicette, pantaloni, lenzuola",
  "Piegatura e riconsegna entro 3 giorni feriali, con giorno e ora comunicati",
  "Cambio piano dall'app in qualsiasi momento, dal mese successivo",
];

const FUORI = [
  "Capi da lavasecco o tintoria: vanno in un sacco separato e si lavorano a listino, fuori dal volume dell'abbonamento",
  "Camicie oltre le 3 comprese in ogni sacchetto, addebitate a capo",
  "Sacchi extra una tantum, oltre il numero previsto dal piano",
  "Trattamenti speciali — macchie difficili, restauri, pelli e piumini — su preventivo prima di lavorare il capo",
];

const NON_SI_PAGA = [
  {
    t: "Non si paga a capo",
    d: "Lo stiro è dentro l'abbonamento su tutti i capi che lo richiedono. Da 3 camicie a sacchetto in su, il conto resta quello del mese.",
  },
  {
    t: "Non si paga il trasporto",
    d: "Ritiro e riconsegna sono inclusi in tutti i piani, anche nelle zone di hinterland servite. Non c'è una soglia da raggiungere per averli gratis.",
  },
  {
    t: "Non si paga il mese che non usi",
    d: "Con la pausa dall'app salti un mese intero e non paghi un servizio che non consumi. Nessun vincolo di durata, nessuna penale di uscita.",
  },
];

const CONFRONTO: { voce: string; noi: string; capo: string; self: string }[] = [
  { voce: "Costo conosciuto prima", noi: "Sì, fisso mensile", capo: "No, cresce con i capi", self: "No, a gettone" },
  { voce: "Stiratura", noi: "Inclusa", capo: "A capo, 2–3 € in più", self: "La fai tu, a casa" },
  { voce: "Ritiro e riconsegna", noi: "Inclusi", capo: "Devi andarci", self: "Devi andarci" },
  { voce: "Chi divide, tratta e piega", noi: "Noi", capo: "Noi, a capo", self: "Tu" },
  { voce: "Ore tue a settimana", noi: "≈ 0", capo: "1–2, tra viaggi e coda", self: "2–3, tra lavaggi e stiro" },
];

type Piano = { id: string; code: string; name: string; price_month_cents: number; bags_per_week: number };
type Categoria = { id: string; name: string; sort: number };
type Voce = { id: string; category_id: string; name: string; price_cli_cents: number; sort: number };

export default async function Prezzi() {
  const supabase = await createClient();
  const [{ data: piani }, { data: categorie }, { data: voci }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, code, name, price_month_cents, bags_per_week")
      .eq("active", true)
      .order("sort")
      .returns<Piano[]>(),
    supabase.from("special_categories").select("id, name, sort").order("sort").returns<Categoria[]>(),
    supabase
      .from("special_items_public")
      .select("id, category_id, name, price_cli_cents, sort")
      .order("sort")
      .returns<Voce[]>(),
  ]);

  const lista = piani ?? [];
  const perSettimana = (p: Piano) => Math.round(p.price_month_cents / SETTIMANE_AL_MESE);
  const perSacco = (p: Piano) => Math.round(p.price_month_cents / SETTIMANE_AL_MESE / p.bags_per_week);
  const minimo = lista.length ? Math.min(...lista.map(perSettimana)) : null;

  const perCategoria = (categorie ?? [])
    .map((c) => ({ ...c, voci: (voci ?? []).filter((v) => v.category_id === c.id) }))
    .filter((c) => c.voci.length > 0);

  // Le domande a schermo, quindi il blocco FAQ nei dati strutturati ci sta: è
  // la condizione che Google chiede, e sulla home l'abbiamo tolto proprio
  // perché lì le domande non si vedevano più.
  const faq = [
    {
      q: "Quanto costa al mese, in totale?",
      a: `${lista.map((p) => `${eur(p.price_month_cents)} al mese per ${p.bags_per_week === 1 ? "un sacco" : `${p.bags_per_week} sacchi`} a settimana`).join(", ")}. In ognuno dei piani ritiro, lavaggio, stiratura di ciò che lo richiede e riconsegna sono compresi: l'importo che leggi è quello che paghi, senza voci aggiunte a fine mese.`,
    },
    {
      q: "E se una settimana non riempio il sacco?",
      a: "Il ritiro avviene comunque: il sacco è tuo e nessuno controlla quanto è pieno. Se sai di non averne bisogno — una settimana fuori, la casa vuota — salti il ritiro dall'app e il sacco non consumato resta a tua disposizione la settimana successiva.",
    },
    {
      q: "Le camicie sono incluse nel prezzo?",
      a: "Sì, fino a 3 camicie stirate per sacchetto. Oltre la soglia, ogni camicia in più si addebita a listino e la vedi nell'ordine prima che venga lavorata.",
    },
    {
      q: "Ci sono costi di attivazione o penali per smettere?",
      a: "Nessuno dei due. Non c'è una quota di ingresso, né un vincolo di durata: puoi mettere l'abbonamento in pausa per un mese dall'app o chiuderlo quando vuoi, senza spiegazioni.",
    },
    {
      q: "Il prezzo cambia in base alla zona o al quartiere?",
      a: "No. Dove passiamo, il prezzo è lo stesso: Milano sud-ovest e i comuni serviti — Assago, Buccinasco, Rozzano — pagano la stessa tariffa, senza supplementi di trasporto e senza minimi d'ordine.",
    },
    {
      q: "Posso cambiare piano quando voglio?",
      a: "Sì, dall'app, con effetto dal mese successivo. Se la famiglia cresce — o la casa si svuota d'estate — il piano si adegua senza rifare il contratto.",
    },
    {
      q: "Quanto costa un sacco extra?",
      a: `${eur(SACCO_EXTRA_CENTS)}, una tantum, oltre il numero previsto dal piano. Si aggiunge dall'app e si ritira nello stesso giorno fisso.`,
    },
  ];

  return (
    <>
      <JsonLd
        data={graficoPagina({
          nomeServizio: "Abbonamento di lavanderia a domicilio a Milano",
          descrizione:
            "Prezzi dell'abbonamento WashLoop: tre piani mensili con ritiro, lavaggio, stiratura e riconsegna inclusi, e il listino dei capi fuori abbonamento.",
          url: URL_PAGINA,
          faq,
        })}
      />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-navy text-white">
        <Bubbles />
        <div className="relative mx-auto max-w-4xl px-5 py-16 text-center md:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan" />
            <span className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-cyan">
              Prezzi · Milano sud-ovest e hinterland
            </span>
          </div>
          <h1 className="mt-6 font-display text-4xl font-black leading-[1.05] tracking-[-0.03em] md:text-6xl">
            Il prezzo del mese,
            <br />
            <span className="text-cyan">prima di iniziare.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-white/65">
            Tre piani, un unico importo mensile. Ritiro, lavaggio, stiratura e riconsegna sono{" "}
            <strong className="font-bold text-white">già dentro</strong>: non si paga a capo, non si paga il
            ritiro, non c&apos;è un carrello da riempire.
          </p>
          <div className="mx-auto mt-9 max-w-xl text-left">
            <VerificaCap />
          </div>
          {minimo != null && (
            <p className="mt-6 font-display text-sm font-bold text-white/45">
              Da {eur(minimo)} a settimana, tutto compreso · metti in pausa quando vuoi
            </p>
          )}
        </div>
      </section>

      {/* ============ I QUATTRO PILASTRI ============ */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {PILASTRI.map((p) => (
            <div key={p.t}>
              <div className="font-display text-sm font-extrabold text-navy">{p.t}</div>
              <p className="mt-1 text-sm font-medium text-muted">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ I TRE PIANI ============ */}
      <section className="bg-ice">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">I piani</div>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Scegli quanti sacchi.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-muted">
            Il piano si misura in sacchi a settimana, non in capi. Il giorno del ritiro è fisso e uguale tutti
            i mesi; la fascia oraria la scegli tu.
          </p>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {lista.map((p) => {
              const c = CARD[p.code];
              const evidenziato = !!c?.evidenza;
              return (
                <div
                  key={p.id}
                  className={`flex flex-col rounded-[24px] border p-7 ${
                    evidenziato ? "border-cyan bg-navy text-white" : "border-line bg-white"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className={`font-display text-xl font-black ${evidenziato ? "text-white" : "text-navy"}`}>
                      {p.name}
                    </h3>
                    {evidenziato && (
                      <span className="rounded-full bg-cyan px-3 py-1 font-display text-[11px] font-extrabold uppercase tracking-wide text-navy">
                        Più scelto
                      </span>
                    )}
                  </div>
                  <div className={`mt-1 font-display text-sm font-bold ${evidenziato ? "text-cyan" : "text-blue"}`}>
                    {p.bags_per_week === 1 ? "1 sacco a settimana" : `${p.bags_per_week} sacchi a settimana`}
                  </div>
                  <p className={`mt-3 text-sm font-medium ${evidenziato ? "text-white/65" : "text-muted"}`}>
                    {c?.per}
                  </p>

                  <div className="mt-6">
                    <span className={`font-display text-5xl font-black ${evidenziato ? "text-white" : "text-navy"}`}>
                      {eur(p.price_month_cents)}
                    </span>
                    <span className={`ml-1 font-display text-base font-bold ${evidenziato ? "text-white/55" : "text-muted"}`}>
                      /mese
                    </span>
                  </div>
                  <div className={`mt-1 text-sm font-medium ${evidenziato ? "text-white/55" : "text-muted"}`}>
                    {eur(perSacco(p))} a sacco · {p.bags_per_week * SETTIMANE_AL_MESE} sacchi al mese
                  </div>

                  <ul className={`mt-6 space-y-2 text-sm font-medium ${evidenziato ? "text-white/80" : "text-navy/80"}`}>
                    {c?.righe(p.bags_per_week).map((r) => (
                      <li key={r} className="flex gap-2">
                        <span className={evidenziato ? "text-cyan" : "text-blue"}>·</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7 pt-1">
                    <ButtonLink href={`/onboarding?plan=${p.code}`} variant={evidenziato ? "light" : undefined}>
                      Attiva {p.name} →
                    </ButtonLink>
                  </div>
                  {c?.evidenza && (
                    <p className="mt-4 text-center font-display text-xs font-bold text-cyan">{c.evidenza}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-[24px] border border-line bg-white p-7">
            <h3 className="font-display text-lg font-extrabold text-navy">
              Un sacco = un borsone pieno, quello che caricheresti in lavatrice.
            </h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-muted">
              Non devi contare i capi né pesare: si contano i sacchi. Dentro va tutto quello che finirebbe in
              lavatrice — camicie, magliette, pantaloni, biancheria, asciugamani, lenzuola. Ogni sacchetto
              comprende fino a 3 camicie stirate; oltre quella soglia le camicie si addebitano a listino, con
              il prezzo che vedi prima.
            </p>
          </div>
        </div>
      </section>

      {/* ============ COME SI LEGGE IL PREZZO ============ */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Lo stesso importo</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Come si legge il prezzo.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-muted">
            Scomposto in quello che conta davvero: quanto costa una settimana di bucato già fatto.
          </p>

          <div className="mt-10 overflow-x-auto rounded-[18px] border border-line">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead className="bg-ice">
                <tr className="font-display text-xs font-extrabold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Piano</th>
                  <th className="px-4 py-3">Sacchi al mese</th>
                  <th className="px-4 py-3">Al mese</th>
                  <th className="px-4 py-3">A settimana</th>
                  <th className="px-4 py-3">Per sacco</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id} className="border-t border-line text-sm font-medium text-navy">
                    <td className="px-4 py-3 font-display font-extrabold">{p.name}</td>
                    <td className="px-4 py-3">{p.bags_per_week * SETTIMANE_AL_MESE}</td>
                    <td className="px-4 py-3">{eur(p.price_month_cents)}</td>
                    <td className="px-4 py-3">{eur(perSettimana(p))}</td>
                    <td className="px-4 py-3 font-bold">{eur(perSacco(p))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {NON_SI_PAGA.map((n) => (
              <div key={n.t} className="rounded-[24px] border border-line bg-ice p-6">
                <h3 className="font-display text-base font-extrabold text-navy">{n.t}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{n.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COMPRESO E NON ============ */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-cyan">Senza sorprese</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] md:text-4xl">
            Cosa è compreso e cosa no.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-white/65">
            Scritto prima, non scoperto a fine mese.
          </p>

          <div className="mt-12 grid gap-10 md:grid-cols-2">
            <div>
              <div className="font-display text-xs font-extrabold uppercase tracking-[0.2em] text-cyan">In tutti i piani</div>
              <ul className="mt-4 space-y-3">
                {COMPRESO.map((c) => (
                  <li key={c} className="flex gap-3 text-sm font-medium text-white/85">
                    <span className="text-cyan">✓</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-display text-xs font-extrabold uppercase tracking-[0.2em] text-white/40">
                Fuori dall&apos;abbonamento
              </div>
              <ul className="mt-4 space-y-3">
                {FUORI.map((c) => (
                  <li key={c} className="flex gap-3 text-sm font-medium text-white/55">
                    <span className="text-white/30">·</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-10 border-t border-white/10 pt-6 text-sm font-medium text-white/65">
            Tutte le voci a listino le vedi nel tuo ordine <strong className="font-bold text-white">prima</strong>{" "}
            che il capo venga lavorato: se non confermi, resta dov&apos;è.
          </p>
        </div>
      </section>

      {/* ============ LISTINO ============ */}
      <section className="bg-ice">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Fuori dal piano</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Il listino, per intero.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-muted">
            Il bucato quotidiano è dentro il piano. Quello che sta fuori — capi da lavasecco, sacchi extra —
            ha un prezzo fisso, pubblicato qui e mostrato nell&apos;ordine prima di procedere. Una regola sola:{" "}
            <strong className="text-navy">nessun capo entra in lavorazione senza che tu abbia visto il prezzo.</strong>
          </p>

          <div className="mt-10 rounded-[18px] border border-line bg-white p-5">
            <div className="flex items-baseline justify-between gap-4 text-sm font-medium text-navy">
              <span className="font-display font-extrabold">Sacco extra una tantum, oltre il piano</span>
              <span className="font-display font-black">{eur(SACCO_EXTRA_CENTS)}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-muted">Stesso giorno fisso, si aggiunge dall&apos;app.</p>
          </div>

          {/* Le categorie: la prima aperta, le altre da aprire. Quarantatré voci
              tutte a schermo sono un muro, e la prima è quella che si cerca. */}
          <div className="mt-6 space-y-3">
            {perCategoria.map((c, i) => (
              <details key={c.id} open={i === 0} className="group rounded-[18px] border border-line bg-white p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-extrabold text-navy">
                  {c.name}
                  <span className="ml-4 flex items-center gap-3">
                    <span className="font-display text-xs font-bold text-muted">{c.voci.length}</span>
                    <span className="text-cyan transition-transform group-open:rotate-45">＋</span>
                  </span>
                </summary>
                <ul className="mt-4 divide-y divide-line">
                  {c.voci.map((v) => (
                    <li key={v.id} className="flex items-baseline justify-between gap-4 py-2 text-sm font-medium text-navy">
                      <span>{v.name}</span>
                      <span className="whitespace-nowrap font-display font-bold">{eur(v.price_cli_cents)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>

          <p className="mt-6 text-xs font-medium text-muted">
            Prezzi IVA inclusa. Trattamenti speciali — macchie difficili, restauri — su preventivo, sempre
            prima di lavorare il capo.
          </p>
        </div>
      </section>

      {/* ============ PERCHÉ IL CONTO TORNA ============ */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Il confronto</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Perché il conto torna.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium text-muted">
            Una camicia in lavanderia a Milano costa tra i 3 e i 5 € tra lavaggio e stiro. Con un piano da due
            sacchi, {lista[1] ? eur(perSacco(lista[1])) : "35 €"} a sacco coprono un borsone intero, stirato e
            riconsegnato.
          </p>

          <div className="mt-10 overflow-x-auto rounded-[18px] border border-line">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead className="bg-ice">
                <tr className="font-display text-xs font-extrabold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Voce a confronto</th>
                  <th className="px-4 py-3 text-blue">WashLoop</th>
                  <th className="px-4 py-3">Lavanderia a capo</th>
                  <th className="px-4 py-3">Self-service</th>
                </tr>
              </thead>
              <tbody>
                {CONFRONTO.map((r) => (
                  <tr key={r.voce} className="border-t border-line text-sm font-medium text-muted">
                    <td className="px-4 py-3 font-display font-extrabold text-navy">{r.voce}</td>
                    <td className="px-4 py-3 font-bold text-navy">{r.noi}</td>
                    <td className="px-4 py-3">{r.capo}</td>
                    <td className="px-4 py-3">{r.self}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs font-medium text-muted">
            Riferimenti di mercato: prezzo medio di una camicia lavata e stirata in lavanderia a Milano tra
            2,60 € e 5,00 €; lavatrice self-service da 9 kg intorno ai 6,00 €, stiratura a tuo carico.
          </p>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-ice">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.26em] text-blue">Domande sul prezzo</div>
          <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.02em] text-navy md:text-4xl">
            Le risposte che di solito arrivano al telefono.
          </h2>
          <div className="mt-10 space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="group rounded-[18px] border border-line bg-white p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-extrabold text-navy">
                  {f.q}
                  <span className="ml-4 text-cyan transition-transform group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm font-medium leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-xs font-medium text-muted">
            Prezzi validi nella zona servita (Milano sud-ovest e comuni in elenco) · IVA inclusa ·{" "}
            <Link href="/lavanderia-a-domicilio-milano#zone" className="text-blue hover:underline">
              vedi le zone coperte
            </Link>
          </p>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="bg-grad">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center text-white">
          <h2 className="font-display text-3xl font-black tracking-[-0.02em] md:text-5xl">
            Sai già quanto costa.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg font-medium text-white/85">
            Verifichiamo se passiamo da te. Nessun pagamento prima dell&apos;attivazione.
          </p>
          <div className="mx-auto mt-8 max-w-xl text-left">
            <VerificaCap />
          </div>
        </div>
      </section>
    </>
  );
}
