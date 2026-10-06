-- 0032_courier_locations.sql
-- Posizione live del rider (aggiornata mentre è in giro). Il rider scrive la propria;
-- l'admin la legge. Il CLIENTE la legge solo via server action gated (ordine attivo +
-- rider vicino alla sua fermata), mai in RLS diretta.
create table if not exists courier_locations (
  courier_id uuid primary key references profiles on delete cascade,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);
alter table courier_locations enable row level security;
drop policy if exists "courier loc self" on courier_locations;
create policy "courier loc self" on courier_locations for all
  using (courier_id = auth.uid()) with check (courier_id = auth.uid());
drop policy if exists "courier loc admin" on courier_locations;
create policy "courier loc admin" on courier_locations for select using (is_admin());
