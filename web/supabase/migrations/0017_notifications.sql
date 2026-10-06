-- 0017 — Notifiche: email lavanderia + iscrizioni push del browser.

-- Contatto email della lavanderia (impostato da admin in Catalogo). Fallback:
-- email del profilo partner collegato (role=partner, laundry_id).
alter table laundries add column if not exists email text;

-- Iscrizioni Web Push (una per dispositivo/endpoint). Il send lato server usa
-- la service role; il cliente gestisce solo le proprie.
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;
create policy "push owner" on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push admin" on push_subscriptions for all
  using (is_admin()) with check (is_admin());
