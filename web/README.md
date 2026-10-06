# WashLoop

Lavanderia a domicilio in abbonamento — Milano. Sito vetrina + WebApp (cliente/ops) come PWA.

Stack: **Next.js 16** (App Router) · **Tailwind v4** · **Supabase** (Postgres/Auth/Realtime/Storage) · **Stripe** (abbonamenti) · deploy **Vercel**.

## Setup locale

1. `npm install`
2. Copia `.env.example` → `.env.local` e compila le chiavi:
   - Supabase: URL, anon key, service_role key (Settings › API)
   - Stripe: secret key, webhook secret, publishable key
3. Applica il DB su Supabase (SQL editor o CLI):
   - `supabase/migrations/0001_init.sql`
   - `supabase/seed.sql`
4. Stripe: crea i 3 prodotti/prezzi (Essential/Plus/Family) e incolla i Price ID in `/admin/catalogo` (oppure aggiorna `plans.stripe_price_id`).
5. `npm run dev` → http://localhost:3000

## Aree

| Path | Ruolo | |
|---|---|---|
| `/` | pubblico | Sito vetrina |
| `/login` | — | Accesso magic-link |
| `/app` | customer | Dashboard, abbonamento, indirizzi, prenota, tracking |
| `/admin` | admin · partner | Board ordini, abbonati, catalogo (zone/slot/piani) |
| `/api/stripe/webhook` | — | Sync abbonamenti Stripe → Supabase |

I ruoli si impostano in `profiles.role` (`customer` default). Per creare un admin: registra l'utente, poi in Supabase imposta `role='admin'`.

## Struttura

- `src/app/(marketing)` — sito vetrina
- `src/app/(app)` — webapp cliente · `src/app/(admin)` — ops
- `src/lib/supabase/` — client browser/server/service · `src/lib/actions/` — server actions
- `src/lib/orders.ts` — stati ordine · `src/components/` — UI (brand da `../Brandbook/`)
- `src/proxy.ts` — refresh sessione + protezione route (Next 16: `proxy`, non `middleware`)

## Note Next.js 16
Turbopack di default · API request async (`cookies`/`params`) · `middleware`→`proxy` (runtime nodejs).
