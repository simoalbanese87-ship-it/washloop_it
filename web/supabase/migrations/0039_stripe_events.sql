-- 0039_stripe_events.sql
-- Deduplica degli eventi Stripe. Stripe ritenta la consegna fino a 3 giorni: senza
-- questa tabella lo stesso `invoice.payment_succeeded` rispediva la ricevuta di
-- addebito al cliente a ogni tentativo.
-- Serve anche come traccia: quali eventi sono arrivati e quando.

create table if not exists stripe_events (
  id           text primary key,          -- event.id di Stripe
  type         text not null,
  received_at  timestamptz not null default now()
);

create index if not exists stripe_events_received_idx on stripe_events (received_at desc);

alter table stripe_events enable row level security;
-- Solo il service role (webhook) scrive; l'admin può guardare per diagnosi.
create policy "stripe_events admin read" on stripe_events for select using (is_admin());
