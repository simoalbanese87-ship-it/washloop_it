-- 0027_laundry_payouts.sql
-- Ledger del costo che WashLoop deve alla lavanderia per gli extra (capi speciali).
-- Oggi il dovuto è solo calcolato a runtime (admin-metrics): questa tabella lo
-- registra come record saldabile. Scritto all'inserimento del capo, azzerato
-- (void) su rimozione/rimborso. Accesso solo via service role (RLS on, no policy).

create table if not exists laundry_payouts (
  id uuid primary key default gen_random_uuid(),
  laundry_id uuid not null references laundries on delete cascade,
  order_id uuid references orders on delete set null,
  special_id uuid references order_specials on delete set null,
  kind text not null default 'special',        -- 'special' | 'bag'
  amount_cents int not null,                    -- comp_lav_cents * qty (IVA escl.)
  status text not null default 'pending',       -- 'pending' | 'settled' | 'void'
  created_at timestamptz not null default now()
);

create index if not exists laundry_payouts_laundry_idx on laundry_payouts(laundry_id);
create index if not exists laundry_payouts_status_idx on laundry_payouts(status);
create index if not exists laundry_payouts_special_idx on laundry_payouts(special_id);

alter table laundry_payouts enable row level security;
-- Nessuna policy: solo il service role (admin/azioni server) vi accede.
