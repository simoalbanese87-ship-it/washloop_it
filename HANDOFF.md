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
- **Supabase**: progetto `rcleyqbntxaiwutdhdpx`. Schema applicato (migrazioni in `web/supabase/migrations/` fino a `0005`).
- **Stripe**: TEST mode attivo (3 prezzi + webhook su `https://washloop.it/api/stripe/webhook`).

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
Lo schema si applica via **Supabase SQL Editor** (incolla i file di `web/supabase/migrations/` in ordine) oppure via Management API con un Personal Access Token `sbp_...` (account → Access Tokens). Il pooler/diretto DB è IPv6 e da rete IPv4 non è raggiungibile: usare SQL Editor o Management API.

## Account di prova (password NON nel git — tienile nel tuo gestore)
- Admin: `washloop.it@gmail.com`
- Cliente: `cliente.test@washloop.it` (abbonato Plus + 1 ordine)
- Rider: `rider.test@washloop.it`

## Stato del progetto (agg. 20 giu 2026)
MVP live: vetrina, auth, abbonamenti Stripe, prenota laundry-centrico + ETA, tracking capo-per-capo, board ops, catalogo+slot, area cliente, corriere, **portale lavanderia** (`/laundry`, dati anonimizzati + capi speciali), **gate prenota dietro abbonamento**.

Aggiunto di recente:
- **Pagine legali**: `/privacy` `/cookie` `/termini` + **cookie banner** (Accetta tutti / Solo necessari) + dati legali reali in `src/lib/legal.ts` (Digital Consulting S.r.l. · P.IVA 09682420964 · Via Franco Russoli 9, 20143 Milano). Email pubblica: info@washloop.it. Manca solo PEC.
- **Email transazionali** via SMTP (Brevo) — `lib/email.ts` + `lib/notify.ts`. Richiede env SMTP su Vercel.
- **Stripe LIVE**: prodotti/prezzi live creati (migration 0011), webhook live `we_1TkNt5...` su `https://washloop.it/api/stripe/webhook`, addebito off-session capi speciali (`lib/actions/charge.ts` + bottone admin order detail).
- **Pannello sicurezza admin** `/admin/sicurezza` (migration 0010, function `security_audit()`). Admin layout ristretto ai soli admin.
- **Webapp cliente — rework mobile (in corso)**: allineamento ai mockup `Washloop(4).zip` (estrai in `design-reference/`, gitignorato). Fase 1 (`MobileShell.tsx` bottom-tab + Home) e **Fase 2** fatte: restyle mobile di **ordini list** (seg Attivi/Storico), **dettaglio ordine** (back bar + hero stato/ETA + timeline realtime), **profilo**, **prenota/abbonamento/indirizzi** (layout mobile). Dati reali, backend invariato. Mancano: **onboarding scuro**, **flusso prenota mockup** (daystrip+slot+capi speciali — serve decisione modello: ordine singolo vs ricorrente), profilo sub-pagine (fatture/invita-amico → serve backend). AI assistant rimandato. Piani `bags_per_week` 1/2/3 (migration 0012).
- **Flusso prenota = mockup** (`BookFlow.tsx`): step daystrip giorni → griglia slot → listino capi speciali reali (vetrina) → conferma (stepper sacchi+note) → success scura. Wired a slot/abbonamento reali (action `bookPickup` ritorna l'id). Verificato end-to-end in prod. **Routing lavanderia = dallo slot scelto** (niente più zona): admin crea slot per la lavanderia, il cliente non vede mai quale.
- **Lavanderia reale**: `Centro Pulitura Bergamo di Narisi Giuseppe & C. Snc` — **solo interno**, **mai mostrata ai clienti**. Migration **0013** la inserisce; migration **0014** blinda la tabella `laundries` (drop policy "laundries read" → SELECT solo admin; partner usa viste 0008/0009, courier non legge). Nome rimosso da tutte le query/UI cliente (prenota/ordini/dettaglio). Account partner di **test** creato: `lavanderia.test@washloop.it` (ruolo partner, `laundry_id` → lavanderia reale) → portale `/laundry`. Zona di servizio = **tutta Milano** (zona unica); rider scelto a mano dall'admin.
- **Slot (giorni/orari)**: gestiti da **admin → Catalogo** (generatore ricorrente: lavanderia + giorni + 2 fasce + capacità, e slot singolo). "Per tutti".
- **Ritiro singolo o ricorrente** (scelta utente): in conferma prenota toggle "Solo questa volta / Ogni settimana". La ricorrenza salva giorno+ora (Roma) in `recurring_pickups` (migration **0015**); Home mostra le ricorrenze attive con "Disattiva" (`cancelRecurring`). **Cron** `/api/cron/recurring` (vercel.json, giornaliero 06:00 UTC, protetto da `CRON_SECRET`) genera gli ordini delle settimane successive su slot reali con stesso giorno+ora; idempotente; salta abbonamenti non attivi.
- **Email**: env SMTP impostate su Vercel (prod+preview) — Brevo `smtp-relay.brevo.com:587`, FROM `noreply@send.washloop.it`, Reply-To `info@washloop.it` (gestito in `lib/email.ts`). Dominio `send.washloop.it` autenticato su Brevo (DKIM/SPF in Cloudflare).
- **Fatture**: `/app/fatture` lista fatture reali da Stripe (link da Profilo). **Uso del mese** su Abbonamento (sacchi/extra/ordini del mese, dati reali).

**Migrazioni** (Supabase SQL Editor o Management API): **0013, 0014, 0015 GIÀ applicate in prod** via Management API. Se reinstalli il DB, applica 0001→0015 in ordine.

**Ancora da fare (mockup)**: onboarding wizard scuro completo (welcome→indirizzo→modalità ritiro→piano→pagamento→success; ora `/login` è scuro + pagine reali separate); **referral** (invita un amico); **modalità di ritiro** (porta/casa/portineria); righe profilo mockup mancanti (metodo pagamento, supporto, impostazioni); AI assistant (rimandato).

**Da fare per il lancio**:
- Admin → Catalogo: **generare slot** per la lavanderia reale (ora gli unici slot futuri puntano alla lavanderia di **test** "WashLoop Lab — Centro"); **disattivare** la lavanderia di test e cancellarne gli slot.
- Pulizia dati di prova (ordini test creati durante QA su `cliente.test`).
- **Ruotare segreti esposti in chat**: token `sbp_a82b...` (Supabase → Account → Access Tokens) + password DB (Settings → Database → Reset); più `sk_live` Stripe già nota.
- Env SMTP su Vercel (Brevo, sottodominio `send.washloop.it` consigliato); PEC in `legal.ts`; 2FA TOTP.
- Webapp: onboarding wizard scuro completo (resta opzionale; `/login` è già scuro).

## Comandi utili
```bash
npm run dev      # sviluppo (Turbopack)
npm run build    # build di produzione (verifica TypeScript)
git push         # → Vercel deploya in automatico su main
```

## Continuare con Claude Code su un altro Mac
La mia memoria/plan è locale a questa macchina (non nel git). Per ripartire con contesto: apri Claude Code nella cartella, e incolla/indica questo `HANDOFF.md` come punto di partenza.
