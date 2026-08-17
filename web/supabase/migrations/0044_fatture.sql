-- 0044 — Ponte verso Fatture in Cloud: token e registro dei documenti emessi.
--
-- Il collegamento nativo Stripe → Fatture in Cloud non esiste: serve sempre un
-- pezzo in mezzo. Qui c'è la parte dati di quel pezzo. Il documento fiscale
-- però NON lo produciamo noi: numerazione, XML, invio allo SdI e conservazione
-- restano a FIC. Da noi resta solo il riferimento, per poterlo mostrare in
-- /admin accanto all'ordine e per sapere cosa è già stato fatturato.
--
-- Nulla di tutto questo si attiva da solo: finché la modalità resta "off"
-- (vedi FIC_MODE) il ponte è inerte. Il regime fiscale — fattura a ogni cliente
-- oppure corrispettivi — è una decisione del commercialista, non del software.

-- Token OAuth2 di Fatture in Cloud. Riga unica.
--
-- In tabella e non in variabile d'ambiente perché il refresh token RUOTA a ogni
-- rinnovo: una env non è scrivibile a runtime, quindi al primo rinnovo il
-- collegamento si romperebbe da solo e nessuno capirebbe perché.
create table if not exists fic_tokens (
  id            int primary key default 1,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  company_id    bigint,
  updated_at    timestamptz not null default now(),
  constraint fic_tokens_riga_unica check (id = 1)
);

alter table fic_tokens enable row level security;
-- Nessuna policy: i token si leggono solo dal server con il service role, che
-- le RLS non le attraversa. Nemmeno un admin loggato deve poterli estrarre via
-- API: sono credenziali, non dati di lavoro.

comment on table fic_tokens is
  'Token OAuth2 di Fatture in Cloud. Riga unica, leggibile solo dal server.';

-- Registro dei documenti emessi su FIC, uno per incasso Stripe.
create table if not exists invoices (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references profiles(id) on delete set null,
  order_id           uuid references orders(id) on delete set null,
  -- Identificatore dell'incasso su Stripe: è la chiave dell'idempotenza.
  stripe_invoice_id  text unique,
  stripe_customer_id text,
  amount_cents       int not null,
  -- Riferimenti restituiti da FIC.
  fic_document_id    bigint,
  fic_number         text,
  fic_url            text,
  -- Stato dell'invio allo SdI, come lo riporta FIC (ei_status).
  ei_status          text,
  stato              text not null default 'da_emettere',
  errore             text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint invoices_stato_valido check (stato in ('da_emettere','emessa','errore','saltata'))
);

comment on column invoices.stato is
  'da_emettere = incasso registrato, documento non ancora creato su FIC; emessa = creato; errore = tentativo fallito, riprovabile; saltata = volutamente non fatturata.';
comment on column invoices.stripe_invoice_id is
  'Chiave di idempotenza: Stripe ritenta i webhook per giorni, e due tentativi non devono produrre due fatture.';

create index if not exists invoices_stato_idx on invoices (stato) where stato <> 'emessa';
create index if not exists invoices_user_idx on invoices (user_id);

alter table invoices enable row level security;

-- Solo admin. Il cliente la sua fattura la riceve da FIC via email o SdI, non
-- la legge da qui: aprirgli questa tabella significherebbe esporre anche stato
-- di invio, errori e riferimenti interni.
create policy "invoices admin" on invoices
  for all using (is_admin()) with check (is_admin());
