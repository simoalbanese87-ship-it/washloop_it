-- 0018 — Mini-CRM admin: prezzo custom abbonamento + registro addebiti cliente.

-- Prezzo concordato custom (es. deal sotto lo Small) e flag "manuale" (abbonamento
-- concesso dall'admin senza Stripe, fatturato offline).
alter table subscriptions add column if not exists custom_price_cents int;
alter table subscriptions add column if not exists manual boolean not null default false;

-- Registro addebiti/rimborsi ad-hoc per cliente (extra personalizzati fuori ordine,
-- modifiche, crediti). Decoupled dagli ordini.
create table if not exists customer_charges (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references profiles on delete cascade,
  description  text not null,
  amount_cents int  not null check (amount_cents >= 0),
  kind         text not null default 'charge',   -- 'charge' | 'refund'
  status       text not null default 'pending',  -- pending | invoiced | settled | void
  stripe_ref   text,
  created_by   uuid references profiles,
  created_at   timestamptz not null default now()
);
create index if not exists customer_charges_cust_idx on customer_charges (customer_id);

alter table customer_charges enable row level security;
-- Admin gestisce tutto; il cliente può leggere i propri (per fatture/uso).
create policy "cc admin" on customer_charges for all using (is_admin()) with check (is_admin());
create policy "cc owner read" on customer_charges for select using (customer_id = auth.uid());
