-- Porta un amico: una settimana in regalo a chi invita
-- ===================================================
--
-- La regola, in una riga: porti un amico, l'amico compra un abbonamento, tu hai
-- una settimana gratis. Il premio e' un credito su Stripe pari a una settimana
-- del piano di chi ha invitato, scalato dalla fattura successiva.
--
-- Il codice di invito non si inventa: e' il `client_code` WL-#### che ogni
-- cliente ha gia' dalla 0008, unico e immutabile, lo stesso stampato sul sacco.
--
-- Due cose nuove e basta:
--
-- 1. da chi e' stato invitato un cliente. Non esisteva nessuna colonna di
--    provenienza su `profiles`: l'unica attribuzione del sistema viveva su
--    `leads.utm`, e moriva li'.
--
-- 2. il registro dei premi. `invitato_id` e' UNICO: un amico vale un premio
--    solo, per sempre. E' la guardia che regge se il webhook arriva due volte,
--    se l'abbonamento viene disdetto e rifatto, o se qualcuno si iscrive due
--    volte con lo stesso invito.

alter table public.profiles
  add column if not exists invitato_da uuid references public.profiles(id) on delete set null,
  add column if not exists invitato_il timestamptz;

comment on column public.profiles.invitato_da is
  'Chi ha portato questo cliente. Si scrive una volta sola, il giorno dell''iscrizione.';
comment on column public.profiles.invitato_il is
  'Quando l''invito e'' stato registrato.';

create index if not exists profiles_invitato_da_idx on public.profiles (invitato_da) where invitato_da is not null;

create table if not exists public.referral_premi (
  id uuid primary key default gen_random_uuid(),
  invitante_id uuid not null references public.profiles(id) on delete cascade,
  invitato_id uuid not null references public.profiles(id) on delete cascade,
  stato text not null default 'maturato',
  valore_cents int not null default 0,
  stripe_balance_tx text,
  motivo text,
  created_at timestamptz not null default now(),
  accreditato_at timestamptz
);

-- Un amico, un premio. Per sempre.
create unique index if not exists referral_premi_invitato_uniq on public.referral_premi (invitato_id);
create index if not exists referral_premi_invitante_idx on public.referral_premi (invitante_id, created_at desc);

alter table public.referral_premi
  drop constraint if exists referral_premi_stato_valido;
alter table public.referral_premi
  add constraint referral_premi_stato_valido
  check (stato in ('maturato', 'accreditato', 'sospeso', 'annullato'));

-- Nessuno puo' premiare se stesso: la guardia sta anche qui, non solo nel codice.
alter table public.referral_premi
  drop constraint if exists referral_premi_non_se_stesso;
alter table public.referral_premi
  add constraint referral_premi_non_se_stesso check (invitante_id <> invitato_id);

comment on table public.referral_premi is
  'Porta un amico: una riga per ogni amico portato. maturato = spetta, accreditato = il credito e'' su Stripe, sospeso = manca il canone su cui calcolarlo.';

alter table public.referral_premi enable row level security;

-- Una sola policy per l'admin: piu' policy possono solo allargare il perimetro.
drop policy if exists referral_premi_admin_all on public.referral_premi;
create policy referral_premi_admin_all on public.referral_premi
  for all using (is_admin()) with check (is_admin());

-- Il cliente vede i premi che ha generato lui, e nient'altro: e' la pagina
-- «Porta un amico» della sua area. Scrive solo il service client del webhook.
drop policy if exists referral_premi_mio on public.referral_premi;
create policy referral_premi_mio on public.referral_premi
  for select to authenticated using (invitante_id = auth.uid());
