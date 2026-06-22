import { Card, PageTitle } from "@/components/app/AppShell";

/** Pagina di riferimento (solo admin): cosa fare per SEO, AISO e attività social.
 *  Contenuto curato e tarato su WashLoop — lavanderia a domicilio a Milano. */

type Item = { t: string; d?: string };
type Block = { kicker: string; title: string; prio: "Alta" | "Media" | "Bassa"; items: Item[] };

const prioTone: Record<Block["prio"], string> = {
  Alta: "bg-[#C0392B]/12 text-[#C0392B]",
  Media: "bg-[#C9881F]/15 text-[#C9881F]",
  Bassa: "bg-navy/10 text-navy",
};

const BLOCKS: Block[] = [
  {
    kicker: "SEO locale",
    title: "Google Business Profile + mappa",
    prio: "Alta",
    items: [
      { t: "Crea/rivendica il Google Business Profile", d: "Categoria «Servizio di lavanderia», area di servizio = Milano (no indirizzo pubblico se ritiri a domicilio). È il canale #1 per «lavanderia a domicilio Milano»." },
      { t: "Compila tutto: orari, telefono, sito washloop.it, foto reali (sacco, ritiro, app)", d: "Profili completi rankano meglio nel local pack." },
      { t: "Bing Places + Apple Business Connect", d: "Apple Maps alimenta Siri/Spotlight; Bing alimenta Copilot/ChatGPT." },
      { t: "NAP coerente ovunque (Nome, P.IVA, recapiti)", d: "Stessi dati su sito, GBP, social, directory. Incoerenze abbassano la fiducia." },
    ],
  },
  {
    kicker: "Recensioni",
    title: "Prova sociale che converte e ranka",
    prio: "Alta",
    items: [
      { t: "Chiedi la recensione Google dopo la consegna", d: "Aggiungi un link recensione nell'email «Consegnato» e in app. Obiettivo: 1 recensione ogni ~5 ordini." },
      { t: "Rispondi a TUTTE le recensioni", d: "Anche alle negative, con tono umano. Segnale forte per Google e per chi legge." },
      { t: "Trustpilot per credibilità nazionale" },
    ],
  },
  {
    kicker: "SEO on-page",
    title: "Pagine che intercettano la domanda",
    prio: "Media",
    items: [
      { t: "Title/description per le query reali", d: "Es. «Lavanderia a domicilio a Milano · ritiro e consegna | WashLoop». Una intenzione per pagina." },
      { t: "Landing per quartiere/zona", d: "/lavanderia-a-domicilio/navigli, /tortona, /isola… contenuto unico, non duplicato. Cattura «lavanderia [zona]»." },
      { t: "Landing per servizio", d: "Lavaggio capi, stireria, piumini, capi in pelle: pagine dedicate col listino reale." },
      { t: "FAQ con dati concreti", d: "Tempi (72h), zone, prezzi, come funziona il sacco. Alimenta featured snippet e risposte AI." },
      { t: "Schema markup", d: "LocalBusiness/Service + FAQPage + Review. JSON-LD nel <head>. Aiuta Google e i crawler AI a capire il servizio." },
      { t: "Core Web Vitals verdi", d: "Già Next.js + Vercel: tieni le immagini ottimizzate e il LCP < 2.5s." },
    ],
  },
  {
    kicker: "AISO",
    title: "Farsi citare da ChatGPT / Gemini / Perplexity",
    prio: "Media",
    items: [
      { t: "Contenuti citabili e fattuali", d: "Le AI citano fonti chiare: pagine con dati espliciti (zone servite, tempi, prezzi, P.IVA, come funziona) vengono riusate nelle risposte." },
      { t: "Esserci nelle fonti che le AI leggono", d: "Recensioni Google/Trustpilot, directory locali, articoli/menzioni stampa locale Milano, Reddit/forum di quartiere." },
      { t: "Pagina «Chi siamo / Come funziona» chiara", d: "Entità ben definita = più facile da citare. Includi città, payoff, modello di servizio." },
      { t: "llms.txt + dati strutturati", d: "Un file che riassume cosa offre WashLoop e a chi; più schema JSON-LD. Facilita l'estrazione da parte dei crawler AI." },
      { t: "Confronti onesti", d: "«WashLoop vs lavanderia tradizionale / vs fai-da-te»: contenuti tipo che le AI amano sintetizzare." },
    ],
  },
  {
    kicker: "Contenuti",
    title: "Blog/guide che portano traffico costante",
    prio: "Bassa",
    items: [
      { t: "Guide pratiche", d: "«Come lavare un piumino», «togliere macchie da camicia», «quanto costa la lavanderia a Milano». Intercettano ricerche informative → poi convertono." },
      { t: "1-2 articoli/mese, evergreen", d: "Meglio pochi e ottimi che tanti deboli." },
      { t: "Collega ogni guida alla landing servizio/zona pertinente" },
    ],
  },
  {
    kicker: "Social",
    title: "Instagram / TikTok / Facebook",
    prio: "Media",
    items: [
      { t: "Formato vincente: prima/dopo + ritiro a domicilio", d: "Reel/TikTok brevi: sacco ritirato → capo trasformato → riconsegnato. Hook nei primi 2 secondi." },
      { t: "Cadenza sostenibile", d: "3-4 reel/sett su IG+TikTok (stesso contenuto), 2-3 story/giorno. Costanza > perfezione." },
      { t: "Local + UGC", d: "Geotag Milano, collabora con micro-creator di quartiere, riposta clienti soddisfatti (con consenso)." },
      { t: "Bio con CTA chiara → washloop.it/onboarding", d: "Link unico al flusso d'iscrizione." },
      { t: "Referral nei social", d: "Quando attivo: «porta un amico, 1 mese gratis» è contenuto condivisibile." },
      { t: "Riusa i contenuti", d: "1 reel → carosello IG → post FB → idea per una guida blog (e viceversa)." },
    ],
  },
  {
    kicker: "Acquisizione",
    title: "Canali a pagamento e partnership",
    prio: "Bassa",
    items: [
      { t: "Google Ads su intent locale", d: "«lavanderia a domicilio milano», «ritiro lavanderia [zona]». Budget piccolo, query ad alta intenzione." },
      { t: "Meta Ads con i reel migliori", d: "Promuovi i contenuti che già performano organicamente." },
      { t: "Partnership di quartiere", d: "Palestre, coworking, portinerie, B&B/affitti brevi: volantini + codice dedicato." },
    ],
  },
  {
    kicker: "Misurazione",
    title: "Capire cosa funziona",
    prio: "Media",
    items: [
      { t: "Google Search Console + Analytics (consent-aware)", d: "Verifica il dominio, monitora query e pagine che portano iscrizioni." },
      { t: "UTM su tutti i link social/ads", d: "Sai da dove arrivano gli abbonati." },
      { t: "Nord star: iscrizioni/settimana e CAC per canale" },
    ],
  },
];

type Guide = { name: string; url: string; steps: string[] };

const GUIDES: Guide[] = [
  {
    name: "Google Business Profile",
    url: "https://business.google.com",
    steps: [
      "Vai su business.google.com → «Gestisci ora», accedi col Google aziendale.",
      "Nome «WashLoop», categoria «Servizio di lavanderia».",
      "Alla domanda sede: scegli «Consegno beni e servizi ai clienti» (area di servizio, NON indirizzo pubblico) → imposta Milano e comuni serviti.",
      "Aggiungi telefono e sito washloop.it.",
      "Verifica l'attività (video o telefono, come proposto).",
      "Completa: orari, descrizione, 5-10 foto reali (sacco, ritiro, app).",
    ],
  },
  {
    name: "Google Search Console",
    url: "https://search.google.com/search-console",
    steps: [
      "Aggiungi proprietà tipo «Dominio» → washloop.it.",
      "Copia il record TXT e incollalo in Cloudflare → DNS (Proxy OFF) → Verifica.",
      "Invia la sitemap: https://washloop.it/sitemap.xml.",
      "Dopo qualche giorno controlla query e pagine in «Rendimento».",
    ],
  },
  {
    name: "Bing (Places + Webmaster)",
    url: "https://www.bingplaces.com",
    steps: [
      "bingplaces.com → «Importa da Google Business Profile» (sincronizza in automatico).",
      "bing.com/webmasters → «Importa da Google Search Console».",
      "Bing alimenta Copilot/ChatGPT: importante per l'AISO.",
    ],
  },
  {
    name: "Apple Business Connect",
    url: "https://businessconnect.apple.com",
    steps: [
      "Accedi con un Apple ID → «Aggiungi la tua attività».",
      "Imposta area di servizio Milano, recapiti, sito.",
      "Verifica: alimenta Apple Maps, Siri, Spotlight (utenti iPhone).",
    ],
  },
  {
    name: "Trustpilot",
    url: "https://business.trustpilot.com",
    steps: [
      "Crea il profilo gratuito per washloop.it.",
      "Prendi il link di invito recensioni e mettilo nell'email «Consegnato».",
      "Fonte molto citata da Google e dalle AI.",
    ],
  },
  {
    name: "Meta Business Suite (Instagram + Facebook)",
    url: "https://business.facebook.com",
    steps: [
      "Crea l'account aziendale Meta → Pagina Facebook «WashLoop».",
      "Converti l'account Instagram in «Aziendale» e collegalo alla Pagina.",
      "Bio con CTA → washloop.it/onboarding.",
      "Da qui gestisci post, programmazione e (poi) le Meta Ads.",
    ],
  },
  {
    name: "TikTok (account business)",
    url: "https://www.tiktok.com",
    steps: [
      "Profilo → Impostazioni → «Passa ad account Business» (categoria: servizi).",
      "Bio + link a washloop.it/onboarding.",
      "Pubblica gli stessi reel di Instagram (prima/dopo + ritiro a domicilio).",
    ],
  },
  {
    name: "Google Analytics (GA4)",
    url: "https://analytics.google.com",
    steps: [
      "Crea una proprietà GA4 per washloop.it.",
      "Installa il tag (consent-aware: parte solo col consenso cookie «Accetta tutti»).",
      "Collega GA4 a Search Console per vedere le query che convertono.",
      "Metti UTM sui link di social e ads per sapere da dove arrivano gli iscritti.",
    ],
  },
];

export default function CrescitaPage() {
  return (
    <>
      <PageTitle
        kicker="Crescita"
        title="SEO · AISO · Attività"
        sub="Cosa fare per farti trovare (Google e AI) e per le attività social. Lista operativa, dalla priorità più alta."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {BLOCKS.map((b) => (
          <Card key={b.title} className="flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-blue">{b.kicker}</div>
              <span className={`rounded-full px-2.5 py-1 font-display text-[11px] font-extrabold ${prioTone[b.prio]}`}>Priorità {b.prio}</span>
            </div>
            <h2 className="mt-1 font-display text-lg font-black text-navy">{b.title}</h2>
            <ul className="mt-3 space-y-2.5">
              {b.items.map((it) => (
                <li key={it.t} className="flex gap-2.5">
                  <span className="mt-0.5 flex-none text-blue">✓</span>
                  <div>
                    <div className="text-sm font-bold text-navy">{it.t}</div>
                    {it.d && <div className="mt-0.5 text-xs font-medium leading-relaxed text-muted">{it.d}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* Guide passo-passo */}
      <div className="mt-8 mb-3 flex items-center gap-3">
        <h2 className="font-display text-lg font-black text-navy">Guide passo-passo — come configurarle</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {GUIDES.map((g) => (
          <Card key={g.name} className="flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-base font-black text-navy">{g.name}</h3>
              <a href={g.url} target="_blank" rel="noopener noreferrer" className="flex-none font-display text-xs font-extrabold text-blue hover:underline">Apri →</a>
            </div>
            <ol className="mt-3 list-inside list-decimal space-y-1.5 text-sm font-medium leading-relaxed text-muted marker:font-bold marker:text-blue">
              {g.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <div className="font-display text-sm font-extrabold text-navy">Ordine consigliato (primi 30 giorni)</div>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm font-medium text-muted">
          <li>Google Business Profile completo + Bing/Apple + verifica Search Console</li>
          <li>Schema LocalBusiness + FAQ sul sito; title/description sulle pagine chiave</li>
          <li>Flusso recensioni post-consegna attivo</li>
          <li>3-4 reel/sett (prima/dopo + ritiro a domicilio), bio → /onboarding</li>
          <li>2-3 landing per zona Milano + 1 guida evergreen</li>
        </ol>
      </Card>
    </>
  );
}
