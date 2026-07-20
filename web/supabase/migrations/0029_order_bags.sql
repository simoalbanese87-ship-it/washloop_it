-- 0029_order_bags.sql
-- Pacco/borsa per ordine: 1 riga per borsa fisica scansionata dal rider.
-- Il QR sulla borsa = client_code (fisso, riusato ritiro+consegna); ogni scan al
-- ritiro crea un pacco con token univoco; alla consegna si marca lo stesso pacco.
create table if not exists order_bags (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  seq int not null,                          -- 1..orders.bags
  token text not null unique,                -- riferimento univoco pacco
  pickup_scanned_at timestamptz,
  pickup_by uuid references profiles on delete set null,
  delivery_scanned_at timestamptz,
  delivery_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (order_id, seq)
);
create index if not exists order_bags_order_idx on order_bags(order_id);

alter table order_bags enable row level security;

-- Il rider assegnato e l'admin possono leggere i pacchi del proprio ordine.
-- (Le scritture avvengono via service role nell'action scanBag.)
create policy "order_bags read" on order_bags for select
  using (
    is_admin()
    or order_id in (select id from orders where courier_id = auth.uid())
  );
