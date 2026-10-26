# WashLoop — Handoff / Ripartenza

Guida per riprendere il lavoro su un'altra scheda del terminale o su un altro Mac.
Il **codice** sta tutto su GitHub. I **secret** no (sono fuori dal git). Questo file colma il resto.

---

## TL;DR — riprendere su un nuovo Mac
```bash
git clone https://github.com/simoalbanese87-ship-it/washloop_it.git
cd washloop_it/web
npm install
# recupera le env dal progetto Vercel (modo più pulito):
npx vercel link        # collega alla cartella al progetto washloop-it
npx vercel env pull .env.local
npm run dev            # http://localhost:3000
```
Su **un'altra scheda dello stesso Mac**: basta `cd .../washloop/web` ed è già tutto pronto (env e git già configurati).

---

## Cosa è già configurato (non serve rifarlo)
- **Repo GitHub**: `simoalbanese87-ship-it/washloop_it` (branch `main`). Root del repo = cartella `washloop/`; l'app Next.js è in `web/`.
- **Vercel**: progetto `washloop-it`, Root Directory = `web`, auto-deploy ad ogni push su `main`. Dominio `washloop.it` (Cloudflare → Vercel).
- **Supabase**: progetto `rcleyqbntxaiwutdhdpx`. Schema applicato (migrazioni in `web/supabase/migrations/`, **fino a 0106**).
- **Stripe**: **LIVE** (webhook su `https://washloop.it/api/stripe/webhook`). Gli incassi finiscono in `invoices` e si rileggono da `/admin/incassi`.

## Env necessarie (`web/.env.local`)
NON sono nel git. Recuperale con `vercel env pull` oppure ricreale a mano:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          # Supabase → Settings → API
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET              # Stripe → Developers → Webhooks
NEXT_PUBLIC_SITE_URL=https://washloop.it
```
⚠️ Le chiavi (anon/service/Stripe) si recuperano dai rispettivi cruscotti. Non committarle mai.

## Push su un nuovo Mac (autenticazione git)
Le credenziali git stanno nel portachiavi del Mac attuale e **non si trasferiscono**. Sul nuovo Mac, al primo `git push` ti chiede user+password:
- **Username**: `simoalbanese87-ship-it`
- **Password**: un **Personal Access Token** GitHub (fine-grained, repo `washloop_it`, permesso *Contents: Read and write*) — crealo su https://github.com/settings/tokens?type=beta
- Nota: questo repo usa `git config http.version HTTP/1.1` (già nel repo) per evitare errori 400 nel push.

---

## Architettura (dove sta cosa)
App Next.js 16 (App Router, TS, Tailwind v4) in `web/`:
- `src/app/(marketing)/` — sito vetrina pubblico (`/`)
- `src/app/(app)/` — webapp cliente (`/app/...`: dashboard, prenota, ordini, indirizzi, abbonamento, profilo)
- `src/app/(admin)/` — ops (`/admin`: board, archivio, abbonati, catalogo, ordini/[id], etichetta)
- `src/app/(courier)/` — corriere (`/courier`)
- `src/app/login`, `src/app/auth/callback` — accesso (email+password)
- `src/app/api/stripe/webhook` — sync abbonamenti
- `src/lib/` — `supabase/` (client/server/service), `actions/` (server actions), `orders.ts`, `format.ts` (date in Europe/Rome), `auth.ts`, `stripe.ts`
- `src/components/` — UI (`Logo`, `ui/Button`, `app/*`, `marketing/*`)
- `src/proxy.ts` — Next 16: sostituisce `middleware`, protegge `/app /admin /courier`
- `supabase/migrations/` + `supabase/setup.sql` — schema DB

Ruoli (in `profiles.role`): `customer` | `courier` | `partner` | `admin`. RLS attiva su tutte le tabelle.

## Migrazioni DB
Lo schema si applica via **Supabase SQL Editor** (incolla i file di `web/supabase/migrations/` in ordine) oppure via **Management API** con il Personal Access Token `sbp_...` — che su questo Mac sta già in `web/.env.local` (`SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`): è la strada che uso io. Il pooler/diretto DB è IPv6 e da rete IPv4 non è raggiungibile: usare SQL Editor o Management API.

## Account di prova (password NON nel git — tienile nel tuo gestore)
- Admin: `washloop.it@gmail.com`
- Cliente: `cliente.test@washloop.it` (abbonato Plus + 1 ordine)
- Rider: `rider.test@washloop.it`

## Stato del progetto (agg. 26 ottobre 2026)

**In produzione e in uso con clienti veri.** Stripe è in **LIVE**. Le migrazioni sono **106** (`web/supabase/migrations/`, applicate in prod via Management API). I test sono **431**, tutti verdi: `npm test`.

### Come funziona il lavoro, in cinque righe
1. **Le fasce** (`slots`) sono il calendario: fuori da lì non si prenota niente.
2. **Il cancello**: prenota chi ha un abbonamento vivo **oppure** la spunta `profiles.a_consumo`.
3. **Il ritiro** nasce in tre modi: dal cliente in app, dalla ricorrenza (cron giornaliero, abbina per giorno **e ora esatta**), o a mano dall'admin.
4. **La destinazione**: decide la fascia — una fascia `stiro` manda in stireria — poi il servizio a sacco del cliente, poi la lavanderia generale.
5. **I soldi**: il canone corre su Stripe; i capi extra si incassano **dopo** che la lavanderia ha contato i sacchi.

Il flusso per esteso, con i punti deboli, sta nelle slide: https://claude.ai/artifact/HduzeovDYTng2q1LK5H6sg

### Il calendario generale (deciso da Simone il 2 e il 12 ottobre 2026)
| | Giorno | Ora | Chi la vede |
|---|---|---|---|
| Ritiro | martedì | 08:30–12:00 | lava e stira |
| Ritiro | mercoledì | 08:30–12:00 | solo stiro |
| Riconsegna | venerdì | 14:00–18:00 | tutti (giro unico) |

Ritiri la mattina, riconsegne il pomeriggio. **Questo è il calendario generale e non si tocca senza che lo chieda lui.** Una fascia non si può assegnare a un cliente — l'unico filtro è il servizio — quindi quella aperta «per Tizio» entra nell'app di tutti quelli come lui: per questo chi ne apre una sceglie **quanto vale** (per sempre / solo questa settimana / fino al…) e scrive perché. Le spot scadute si vedono in cima a `/admin/catalogo`.

### Le due lavanderie
- **Centro Pulitura Bergamo** (Zanica) — lava e stira.
- **Susanna Ferrari** (Corsico) — solo stiro.

Sono lontane: una giornata può contenere tutti e due i giri, e il rider lo legge in cima alla pagina. Nel giro vengono **prima le riconsegne, poi i ritiri** — ma l'orario della fascia vince sulla fase, quindi col calendario attuale la giornata è ritiri la mattina e riconsegne il pomeriggio.

### Aree del pannello
`/admin` board · `persone` (lead e clienti in una lista sola) · `abbonati/[id]` (scheda cliente: abbonamento, soldi, capi compresi, ricorrenze) · `ordini/[id]` · `calendario` (passaggi) · `catalogo` (piani, lavanderie, zone, **generatore fasce**) · `incassi` (+ CSV per il commercialista) · `competenza` (ricavi e costi per settimana) · `etichette` (tag QR dei sacchi) · `team` (accessi staff e **cambio ruolo**) · `sicurezza` (controlli automatici).

### Cose da sapere prima di toccare qualcosa
- **Le chiavi Supabase nelle env hanno spazi e a capo dentro**: usare sempre `createServiceClient()`, mai costruirsi un client a mano. Due cron sono stati morti per mesi per questo.
- **RLS risponde vuoto, non in errore**: una lettura che decide qualcosa va fatta col service client.
- **Next.js 16**: `src/proxy.ts` al posto del middleware; leggere `node_modules/next/dist/docs/` prima di scrivere codice.
- **Moduli puri + `node:test`**: la regola che si sbaglia in silenzio va in un modulo senza database, con i suoi test (50 file `*.test.ts` in `src/lib/`).
- **Deploy**: `git push` e basta; lo stato si guarda dal connettore Vercel, **mai** cicli `npx vercel` in background.
- **Verifica in produzione premendo il bottone**: se non si può, dirlo.

### Da fare / da decidere
- Capienza del venerdì pomeriggio (ora 10 posti) ora che le riconsegne sono un giro solo.
- Se togliere il link **«una tantum»** dalla scheda cliente: incassa ma non apre nessun abbonamento, e il cliente resta fuori dal cancello.
- Notifica push a ogni richiesta «Su misura» (oggi arriva solo una mail).
- **Ruotare i segreti** passati in chat: Stripe `sk_live`, token Supabase `sbp_`, chiavi Brevo, e la password dell'account admin di Martina Lippi.
- Meryl e il banco lavanderia devono attivare le notifiche dai loro telefoni.
- Scheda Google doppia da far unire.
- **Feste di dicembre**: 17 giorni senza riconsegna fra il 22/12 e l'8/01, si decide a metà novembre.

## Comandi utili
```bash
npm run dev      # sviluppo (Turbopack)
npm run build    # build di produzione (verifica TypeScript)
git push         # → Vercel deploya in automatico su main
```

## Continuare con Claude Code
La memoria di Claude è **locale a questa macchina** e fuori dal git: sta in
`~/.claude/projects/-Users-simonealbanese-Documents-Claude-AI-washloop-it/memory/`,
con `MEMORY.md` come indice. Lì dentro ci sono le regole che non si deducono dal codice —
come si gestiscono prove e rimborsi, chi paga cosa, cosa non va toccato.

- **Stessa macchina**: apri Claude Code nella cartella e fai `resume`. La memoria si carica da sola;
  il file `lavori-aperti-*.md` dice dove eravamo rimasti.
- **Un altro Mac**: quella memoria non c'è. Parti da questo `HANDOFF.md` e dillo subito a Claude.
