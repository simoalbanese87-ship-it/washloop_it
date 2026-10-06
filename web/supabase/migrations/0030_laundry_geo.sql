-- 0030_laundry_geo.sql
-- Coordinate della lavanderia = deposito (origine/fine giro rider). Visibile solo
-- ad admin/lavanderia/rider, mai al cliente.
alter table laundries add column if not exists lat double precision;
alter table laundries add column if not exists lng double precision;

-- Il rider (e il partner) possono leggere le lavanderie (nome + coordinate deposito).
-- Il CLIENTE resta escluso: il deposito non è mai visibile lato cliente.
drop policy if exists "laundries staff read" on laundries;
create policy "laundries staff read" on laundries for select
  using (auth_role() in ('courier','partner','admin'));
