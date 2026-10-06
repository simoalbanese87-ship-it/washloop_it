-- Il link di pagamento personalizzato non si salvava da nessuna parte.
--
-- L'admin generava l'offerta, il link compariva una volta sotto al form, lo
-- mandava al cliente — e da quel momento non ne restava traccia: riaprendo la
-- scheda non c'era scritto né che una proposta esisteva, né a quanto, né che
-- si stava aspettando un pagamento. Un cliente in attesa risultava identico a
-- uno con cui non si era mai parlato.
--
-- Tabella separata da `subscriptions` di proposito: qui non c'è ancora nessun
-- abbonamento, c'è una proposta. Metterla lì dentro con uno stato finto
-- avrebbe sporcato i conteggi degli attivi e si sarebbe scontrata con
-- l'upsert del webhook, che riconosce le righe da `stripe_subscription_id`.

create table if not exists public.subscription_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  checkout_url text not null,
  checkout_session_id text,
  -- Le sessioni di Checkout scadono (24 ore, se Stripe non dice altro): la
  -- scadenza si mostra, perché un link morto mandato al cliente è peggio che
  -- nessun link.
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists subscription_offers_user_idx
  on public.subscription_offers (user_id, created_at desc);

alter table public.subscription_offers enable row level security;

-- Solo l'amministrazione: contiene un link che avvia un pagamento.
drop policy if exists subscription_offers_admin_all on public.subscription_offers;
create policy subscription_offers_admin_all on public.subscription_offers
  for all using (is_admin()) with check (is_admin());
