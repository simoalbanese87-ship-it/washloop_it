-- ============================================================
-- 0003 — Modello laundry-centrico + ETA
-- ============================================================

-- Gli slot appartengono a una lavanderia
alter table slots add column if not exists laundry_id uuid references laundries on delete cascade;

-- Data "pronto" stimata/affinata mostrata al cliente
alter table orders add column if not exists eta_ready_at timestamptz;

-- Turnaround per piano (ore) → ETA automatica
alter table plans add column if not exists turnaround_hours int not null default 48;
update plans set turnaround_hours = 48 where code = 'essential';
update plans set turnaround_hours = 24 where code in ('plus', 'family');

-- Il partner (lavanderia) gestisce gli slot della propria lavanderia
drop policy if exists "slots partner" on slots;
create policy "slots partner" on slots for all
  using (laundry_id = my_laundry_id())
  with check (laundry_id = my_laundry_id());

create index if not exists slots_laundry_idx on slots (laundry_id, kind, starts_at);
