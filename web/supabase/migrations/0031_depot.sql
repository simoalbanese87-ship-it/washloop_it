-- 0031_depot.sql
-- Deposito/hub logistico INTERNO (non la lavanderia): il furgone raccoglie i ritiri
-- dai rider, li porta in lavanderia, riporta il pulito e lo lascia ai rider per le
-- consegne. Origine/rientro del giro rider. Solo staff (admin/rider/partner) — MAI
-- visibile al cliente.
create table if not exists depots (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Deposito Milano',
  address text,
  lat double precision,
  lng double precision,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table depots enable row level security;
drop policy if exists "depots staff read" on depots;
create policy "depots staff read" on depots for select using (auth_role() in ('courier','partner','admin'));
drop policy if exists "depots admin write" on depots;
create policy "depots admin write" on depots for all using (is_admin()) with check (is_admin());

-- Seed hub Milano (Via Pizzi 24) geocodificato, se non esiste già un deposito.
insert into depots (name, address, lat, lng, active)
select 'Deposito Milano', 'Via Pizzi 24, 20141 Milano', 45.4370615, 9.2029218, true
where not exists (select 1 from depots);
