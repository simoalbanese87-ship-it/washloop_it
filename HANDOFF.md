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
- **Webapp cliente — rework mobile (in corso)**: allineamento ai mockup `Washloop(4).zip` (estrai in `design-reference/`, gitignorato). Fase 1 fatta (`MobileShell.tsx` bottom-tab + Home). Mancano fasi: prenota, ordini+dettaglio, profilo (fatture/invita-amico), onboarding scuro. AI assistant rimandato. Piani `bags_per_week` 1/2/3 (migration 0012).

**Migrazioni** (Supabase SQL Editor o Management API): applicate fino a **0012**. Se reinstalli il DB, applica 0001→0012 in ordine.

**Da fare per il lancio**: ruotare `sk_live` (esposta in chat) e aggiornare env Vercel; impostare env SMTP su Vercel; aggiungere PEC in `legal.ts`; confermare dati lavanderia reale; pulizia dati di prova; 2FA TOTP; continuare fasi webapp.

## Comandi utili
```bash
npm run dev      # sviluppo (Turbopack)
npm run build    # build di produzione (verifica TypeScript)
git push         # → Vercel deploya in automatico su main
```

## Continuare con Claude Code su un altro Mac
La mia memoria/plan è locale a questa macchina (non nel git). Per ripartire con contesto: apri Claude Code nella cartella, e incolla/indica questo `HANDOFF.md` come punto di partenza.
