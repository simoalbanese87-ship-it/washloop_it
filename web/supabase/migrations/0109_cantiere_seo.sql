-- Il cantiere SEO: le cose da fare per farsi trovare, scritte una volta sola.
--
-- Perché
-- ------
-- `/admin/crescita` è una pagina di riferimento: spiega bene *perché* servono
-- certe cose, ma è testo fisso. Non si spunta, non ricorda chi doveva farla,
-- non dice dove si va a controllare se ha funzionato. Risultato: la si legge,
-- si annuisce, e il mese dopo si rilegge uguale.
--
-- Qui dentro ci sono le stesse cose come *lavori*: ognuna ha uno stato, una
-- priorità, il posto esatto dove si fa e il posto esatto dove si verifica.
-- Non è un elenco di buoni propositi — è la lista che si guarda il lunedì.
--
-- Le voci iniziali nascono dall'audit del 29 ottobre 2026 (indicizzazione,
-- local, contenuti, tecnico). Quelle che richiedono una decisione di Simone
-- sono marcate `decide_simone`: il pannello le mette in cima, perché nessuno
-- può farle al posto suo.

create table if not exists public.seo_tasks (
  id          uuid primary key default gen_random_uuid(),
  titolo      text not null,
  -- Perché conta. Senza questo campo, fra tre mesi una voce rimasta indietro
  -- sembra burocrazia e si cancella.
  perche      text,
  -- Come si fa, in parole operative: il menu, il bottone, il file.
  come        text,
  -- Dove si verifica che sia servita. Un lavoro SEO senza il suo posto di
  -- verifica è un lavoro che nessuno saprà mai se è andato bene.
  dove        text,
  categoria   text not null check (categoria in ('indicizzazione','locale','contenuti','tecnico','fiducia','misura')),
  priorita    text not null default 'media' check (priorita in ('alta','media','bassa')),
  stato       text not null default 'da_fare' check (stato in ('da_fare','in_corso','fatto','non_serve')),
  -- true = non si può delegare: serve un account, una decisione o una firma
  -- che ha solo Simone.
  decide_simone boolean not null default false,
  nota        text,
  sort        int not null default 0,
  fatto_at    timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.seo_tasks is
  'I lavori per farsi trovare (organico, local, AI). Nati dall''audit del 29/10/2026. Si guardano in /admin/seo.';
comment on column public.seo_tasks.dove is
  'Il posto dove si controlla il risultato: Search Console, la scheda Google, l''URL della pagina. Serve a non dover ricordare dove si guarda.';
comment on column public.seo_tasks.decide_simone is
  'true = nessuno può farla al posto suo (account, soldi, decisione commerciale).';

alter table public.seo_tasks enable row level security;

drop policy if exists seo_tasks_admin on public.seo_tasks;
create policy seo_tasks_admin on public.seo_tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create index if not exists seo_tasks_stato_idx on public.seo_tasks (stato, priorita, sort);

-- Le voci dell'audit del 29 ottobre 2026. `on conflict` non serve: la tabella
-- nasce ora, e se un giorno si rifà l'audit le voci nuove si aggiungono dal
-- pannello, non da una migrazione.
insert into public.seo_tasks (sort, titolo, perche, come, dove, categoria, priorita, decide_simone) values
 (10, 'Verificare washloop.it in Google Search Console',
  'È l''unico posto che dice quali pagine Google ha in indice, con quali parole ci trova e quante volte. Senza, qualsiasi lavoro SEO è a occhi chiusi: oggi non sappiamo nemmeno perché 4 pagine su 6 non risultano in indice.',
  'search.google.com/search-console, «Aggiungi proprietà» -> Dominio -> washloop.it. Chiede un record TXT nel DNS (il dominio è su Vercel: Project -> Settings -> Domains -> DNS Records).',
  'search.google.com/search-console', 'indicizzazione', 'alta', true),
 (20, 'Capire perché 4 pagine su 6 non sono in indice',
  'Cercando site:washloop.it il 29/10/2026 Google mostrava solo 3 risultati: home, /privacy (che è noindex e va tolta da sola) e /servizio-stiro-a-domicilio-milano. Mancano /lavanderia-a-domicilio-milano (la pagina più importante), /prezzi, /come-funziona e /porta-un-amico. Finché non sono in indice non possono portare un solo clic.',
  'In Search Console: Pagine -> «Non indicizzate», e poi Ispeziona URL su ciascuna delle quattro. Se dice «Rilevata, non indicizzata» o «Scansionata, non indicizzata» è un problema di autorità e contenuto, non tecnico: si risolve con le voci di questo elenco, non premendo di nuovo il bottone.',
  'Search Console -> Pagine; poi Ispeziona URL', 'indicizzazione', 'alta', false),
 (30, 'Inviare la sitemap e chiedere l''indicizzazione delle 4 pagine',
  'La sitemap esiste e risponde (washloop.it/sitemap.xml, 6 URL), ma non risulta inviata. Chiedere l''indicizzazione non garantisce nulla: mette la pagina in coda.',
  'Search Console -> Sitemap -> inserire sitemap.xml. Poi Ispeziona URL -> «Richiedi indicizzazione» per le 4 pagine fuori indice.',
  'Search Console -> Sitemap', 'indicizzazione', 'alta', false),
 (40, 'Bing Webmaster Tools',
  'Bing alimenta Copilot e parte delle risposte di ChatGPT. È gratis e si importa da Search Console in due clic.',
  'bing.com/webmasters -> importa da Google Search Console.',
  'bing.com/webmasters', 'indicizzazione', 'media', true),
 (50, 'Unire la scheda Google duplicata',
  'Esistono due schede: quella gestita (g.page) e un duplicato non gestito che si tiene una recensione a 5 stelle. Due schede si dividono i segnali e confondono chi cerca. Il duplicato NON va segnalato come chiuso: si perde la recensione.',
  'Da business.google.com, con l''account proprietario della scheda gestita: Aiuto/Supporto -> unione schede duplicate, allegando i due link. Richiede tempo e non è garantita.',
  'business.google.com', 'locale', 'alta', true),
 (60, 'Scheda Google: categoria, aree servite, orari, servizi',
  'Per «lavanderia a domicilio milano» il primo blocco di risultati è la mappa, non i siti. La categoria primaria è il fattore di posizionamento numero uno di quel blocco, e una categoria sbagliata è il danno numero uno.',
  'business.google.com -> Modifica profilo. Categoria primaria «Servizio di lavanderia». Attività con area di servizio (indirizzo nascosto, non ricevi clienti in Via Russoli). Aree: solo quelle coperte davvero (Milano + Assago, Buccinasco, Rozzano). Servizi con i prezzi veri. Orari, e orari speciali per le feste di dicembre.',
  'business.google.com -> Modifica profilo', 'locale', 'alta', true),
 (70, 'Chiedere la recensione Google a ogni riconsegna',
  'Zero recensioni = zero prova sociale e nessuna possibilità nel blocco mappa. Conta più il flusso costante del totale: una ogni settimana vale più di venti tutte insieme a gennaio.',
  'Mettere il link della scheda gestita nella mail «Consegnato» e in app dopo la riconsegna. Chiederlo a tutti, non solo a chi sembra contento, e senza regalare nulla in cambio (è vietato). Rispondere a tutte, anche alle negative.',
  'business.google.com -> Recensioni', 'locale', 'alta', false),
 (80, 'Apple Business Connect e Bing Places',
  'Apple Maps alimenta Siri e Spotlight, Bing Places alimenta Copilot. Sono gratuiti e nessuno dei concorrenti piccoli li compila.',
  'businessconnect.apple.com e bingplaces.com: stessi dati identici a Google (nome, telefono, zone).',
  'businessconnect.apple.com', 'locale', 'media', true),
 (90, 'Collegare la scheda Google al sito (sameAs, hasMap, orari)',
  'Lo schema del sito è già fatto bene (DryCleaningOrLaundry con partita IVA e zone), ma non dice a Google che quella scheda e questo sito sono la stessa azienda. sameAs e hasMap fanno esattamente quello.',
  'In src/lib/area-servita.ts, dentro attivitaJsonLd(): aggiungere sameAs (link g.page + Instagram + Facebook), hasMap (link g.page) e openingHoursSpecification. Serve prima il link vero della scheda.',
  'search.google.com/test/rich-results', 'locale', 'media', false),
 (100, 'Decidere i piani: 280 € e 390 € sono spenti nel listino ma scritti sul sito',
  'La pagina /lavanderia-a-domicilio-milano dice «160 € per 1 sacco, 280 € per 2, 390 € per 3». Nel database i piani Medium (280 €) e Large (390 €) sono active=false: oggi non si possono comprare. Stiamo promettendo pubblicamente prezzi che non vendiamo, e la stessa pagina /prezzi non li nomina.',
  'Decidere: o si riattivano i due piani, o la frase va tolta dalla pagina. Non è una correzione di testo: è una decisione commerciale.',
  'washloop.it/lavanderia-a-domicilio-milano; /admin/listino', 'contenuti', 'alta', true),
 (110, 'Decidere la copertura: «tutta Milano dal 20121 al 20162» oppure «solo sud-ovest»',
  'La stessa pagina dice sopra «partiamo dal quadrante sud-ovest» e nelle FAQ «ritiriamo in tutta Milano città, dal 20121 al 20162». Chi legge non sa se è coperto, e chi arriva dal CAP sbagliato diventa un lead che non possiamo servire.',
  'Scegliere la frase vera e usare quella ovunque: pagina, FAQ, scheda Google, schema.',
  'washloop.it/lavanderia-a-domicilio-milano', 'contenuti', 'alta', true),
 (120, 'Sistemare il confronto prezzi di /prezzi',
  'La tabella usa «30,50 € a sacco con un piano da due sacchi»: 30,50 € è il prezzo del solo stiro, e il piano da due sacchi oggi non si vende. Un confronto con un numero sbagliato, su una pagina che punta tutto sulla trasparenza, è il danno peggiore.',
  'Rifare il conto con i prezzi veri (40 € a sacco su Lava e stira) e mettere la fonte e la data dei prezzi di mercato citati.',
  'washloop.it/prezzi', 'contenuti', 'alta', false),
 (130, 'Allineare il «da 160 €» con il Solo stiro a 122 €',
  'Meta description, testi e Offer nei dati strutturati dicono «da 160 €/mese», ma il piano più economico è Solo stiro a 122 €. Chi confronta pagina e schema trova due prezzi minimi diversi.',
  'In src/app/(marketing)/ le description, e in src/lib/area-servita.ts servizioJsonLd(): un Offer per piano, oppure AggregateOffer con lowPrice 122.',
  'search.google.com/test/rich-results', 'contenuti', 'media', false),
 (140, 'Pagina Chi siamo (oggi è 404)',
  'Un servizio a cui consegni i vestiti di casa senza sapere chi è non si sceglie. Non c''è una faccia, un nome, una storia: è il buco più grande sulla fiducia, e l''unico che si chiude in un pomeriggio.',
  'Nuova pagina /chi-siamo: Simone con nome, ruolo e foto vera; perché è nata WashLoop; chi lava (laboratorio partner, dove); foto del posto. Poi Person e founder nello schema.',
  'washloop.it/chi-siamo', 'fiducia', 'alta', false),
 (150, 'Pagina Contatti con il telefono in chiaro',
  'Il numero oggi sta solo dentro i dati strutturati: Google lo legge, le persone no. Un recapito visibile è un segnale di fiducia e serve anche per le citazioni nelle directory.',
  'Nuova pagina /contatti: telefono, email, orari di risposta, zone servite, e se la sede di Via Russoli è operativa o solo legale.',
  'washloop.it/contatti', 'fiducia', 'media', false),
 (160, 'Scrivere cosa succede se un capo si rovina o si perde',
  'È la domanda che tutti si fanno e che nessun concorrente piccolo pubblica. Pubblicarla è insieme un segnale di fiducia e una pagina che intercetta «lavanderia a domicilio è sicura».',
  'Pagina o sezione dedicata: tempi di reclamo, massimali, come si rimborsa. Deve rispecchiare quello che facciamo davvero.',
  'washloop.it', 'fiducia', 'media', true),
 (170, 'Tre pagine di zona, una alla volta',
  'Su «lavanderia a domicilio milano» competono lavanderie con anni di recensioni. Su «lavanderia a domicilio buccinasco» non compete quasi nessuno — e chi cerca così è già a 10 minuti dal rider.',
  'Una per volta, con contenuto vero: /lavanderia-a-domicilio-navigli, poi Barona-Lorenteggio, poi Assago-Buccinasco-Rozzano. Dentro: giorno di passaggio reale della zona, vie, fasce. Se cambia solo il nome della zona sono pagine fotocopia e Google le ignora.',
  'Search Console -> Rendimento, filtro per pagina', 'contenuti', 'alta', false),
 (180, 'Guida: quanto costa una lavanderia a domicilio a Milano',
  'È la domanda che si fa prima di scegliere. Vince chi pubblica numeri veri con fonte e data: un''indagine su 10-15 lavanderie milanesi non ce l''ha nessuno, e diventa la pagina che gli altri citano.',
  'Articolo lungo (1.500-1.800 parole) con la tabella dei prezzi rilevati, data e metodo. Collegato a /prezzi.',
  'Search Console -> Rendimento', 'contenuti', 'media', false),
 (190, 'Guida: come stirare una camicia (con foto nostre)',
  'Query molto cercata, risultati vecchi e generici. Con le foto di chi stira davvero diventa il contenuto che dimostra competenza — la cosa che oggi al sito manca di più.',
  'Articolo con sequenza fotografica propria, firmato con nome e ruolo.',
  'Search Console -> Rendimento', 'contenuti', 'media', false),
 (200, 'Guida: come lavare un piumone in lavatrice',
  'Stagionale, si cerca adesso, e porta dritta al listino (piumone 15,40 €, d''oca 21 €).',
  'Articolo con il caso «quando conviene portarlo in lavanderia» e link al listino.',
  'Search Console -> Rendimento', 'contenuti', 'media', false),
 (210, 'Pagina per gli affitti brevi a Milano',
  'Il piano Su misura già cita le case vacanze ma nessuna pagina si posiziona su «lavanderia per airbnb milano». Nicchia con poca concorrenza e ticket alto.',
  'Pagina dedicata agli host: biancheria, tempi, volumi, come si prenota.',
  'Search Console -> Rendimento', 'contenuti', 'bassa', false),
 (220, 'Togliere /onboarding e /login dall''indice',
  'Rispondono 200 con lo stesso title e la stessa description della home, e /onboarding è linkata da ogni pagina. Sono doppioni sottili che diluiscono il sito.',
  'export const metadata = { robots: { index: false, follow: true } } in src/app/onboarding/page.tsx e src/app/login/page.tsx. NON metterle in robots.txt: un noindex si legge solo se la pagina si può aprire.',
  'curl -s https://washloop.it/onboarding | grep robots', 'tecnico', 'media', false),
 (230, 'www deve rispondere con un redirect permanente',
  'Oggi www.washloop.it fa un 302 (temporaneo) verso washloop.it: Google può tenere www come indirizzo buono e dividere i segnali fra due host.',
  'Vercel -> Project -> Settings -> Domains -> www.washloop.it -> redirect permanente (308).',
  'curl -sI https://www.washloop.it', 'tecnico', 'media', false),
 (240, 'Anteprima dei link (og:image)',
  'Nessuna pagina ha og:image: ogni link condiviso su WhatsApp, Instagram o LinkedIn esce grigio e senza immagine. Non sposta il posizionamento, sposta i clic.',
  'Aggiungere src/app/opengraph-image.png 1200x630 (oppure openGraph.images in layout.tsx) e twitter card summary_large_image.',
  'opengraph.xyz, incollando washloop.it', 'tecnico', 'media', false),
 (250, 'Togliere l''H2 vuoto «Da  non passiamo ancora.»',
  'La finestra di verifica CAP viene stampata nell''HTML anche quando il CAP non c''è: su 5 pagine su 6 il primo titolo che un crawler (e un modello AI) incontra è una frase monca. Le persone non la vedono, le macchine sì.',
  'src/components/lead/VerificaCap.tsx: non stampare il contenuto della finestra finché cap è vuoto.',
  'curl -s https://washloop.it/prezzi | grep "non passiamo"', 'tecnico', 'media', false),
 (260, 'Misura settimanale: 15 minuti di Search Console',
  'Senza un momento fisso si guardano i numeri solo quando le cose vanno male, cioè quando è tardi.',
  'Ogni lunedì: Rendimento (clic, impressioni, query nuove), Pagine (quante indicizzate), e il confronto con la settimana prima.',
  'search.google.com/search-console', 'misura', 'alta', false),
 (270, 'Attivare Vercel Web Analytics',
  'Oggi sul sito non c''è nessuna analitica: ci sono solo il tag Google Ads e il pixel Meta, e partono dopo il consenso. Non sappiamo nemmeno quante visite riceviamo. Vercel Web Analytics è sulla piattaforma che già usiamo, non mette cookie e quindi non tocca il banner.',
  'Vercel -> Project -> Analytics -> Enable, poi npm i @vercel/analytics e <Analytics /> nel layout.',
  'vercel.com -> Analytics', 'misura', 'alta', false),
 (280, 'Prova manuale sulle AI, ogni due settimane',
  'Le risposte di ChatGPT e Perplexity non compaiono in nessun rapporto: l''unico modo di sapere se ci citano è chiederglielo e segnarselo.',
  'Dieci domande fisse (lavanderia a domicilio milano, quanto costa far lavare i vestiti a milano, servizio stiro a domicilio milano...) su ChatGPT, Perplexity e Google AI Mode. Segnare se usciamo, con quale pagina e chi esce al posto nostro.',
  'chatgpt.com, perplexity.ai', 'misura', 'bassa', false),
 (290, 'Chiedere «come ci hai conosciuto» in fase di iscrizione',
  'Chi arriva da una risposta AI o dal passaparola non porta con sé nessuna traccia: senza questa domanda quel canale resta invisibile per sempre.',
  'Un campo facoltativo nell''onboarding, con l''opzione «ChatGPT o altro assistente».',
  '/admin/persone', 'misura', 'bassa', false);
