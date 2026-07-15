-- 0026_zones_scalable.sql
-- Zone scalabili per quadranti CAP + colonne indirizzo strutturate + rider per zona.
-- Scalare = inserire una riga in `zones` e riassegnare i CAP in `zone_caps` (solo dati,
-- nessuna migration). Le 8 zone-quartiere storiche restano (disattivate) per non
-- rompere le FK di indirizzi/lavanderie/slot esistenti.

-- 1) Indirizzo: colonne dedicate (oggi CAP/civico concatenati in street).
alter table addresses add column if not exists cap text;
alter table addresses add column if not exists civico text;
alter table addresses add column if not exists lat double precision;
alter table addresses add column if not exists lng double precision;

-- 2) Zona: rider dedicato (opzionale) + ordinamento.
alter table zones add column if not exists courier_id uuid references profiles on delete set null;
alter table zones add column if not exists sort int not null default 0;

-- 3) Mapping CAP -> zona. Il CAP determina la zona.
create table if not exists zone_caps (
  cap text primary key,
  zone_id uuid not null references zones on delete cascade
);

-- 4) Disattiva le zone-quartiere storiche (FK preservate: righe non cancellate).
update zones set active = false
where name in ('Centro','Brera','Porta Romana','Navigli','Isola','Città Studi','Porta Venezia','Sempione');

-- 5) 4 zone quadrante Milano (idempotente: inserisce solo se assente).
insert into zones (name, city, active, sort)
select v.name, 'Milano', true, v.sort
from (values
  ('Milano Nord-Ovest', 1),
  ('Milano Nord-Est', 2),
  ('Milano Sud-Ovest', 3),
  ('Milano Sud-Est', 4)
) as v(name, sort)
where not exists (select 1 from zones z where z.name = v.name);

-- 6) Mapping CAP -> quadrante (bozza geografica, admin-editabile via zone_caps).
insert into zone_caps (cap, zone_id)
select c.cap, z.id
from (values
  -- Nord-Est: Centro-nord, Zara, Loreto, Città Studi, Lambrate, Niguarda, Bicocca
  ('20121','Milano Nord-Est'),('20124','Milano Nord-Est'),('20125','Milano Nord-Est'),
  ('20126','Milano Nord-Est'),('20127','Milano Nord-Est'),('20128','Milano Nord-Est'),
  ('20131','Milano Nord-Est'),('20132','Milano Nord-Est'),('20133','Milano Nord-Est'),
  ('20134','Milano Nord-Est'),('20162','Milano Nord-Est'),
  -- Sud-Est: Porta Romana, Lodi, Corvetto, Mecenate, Chiaravalle, Porta Vittoria
  ('20122','Milano Sud-Est'),('20129','Milano Sud-Est'),('20135','Milano Sud-Est'),
  ('20137','Milano Sud-Est'),('20138','Milano Sud-Est'),('20139','Milano Sud-Est'),
  -- Sud-Ovest: Magenta, Ticinese, Navigli, Barona, Bande Nere, Gratosoglio
  ('20123','Milano Sud-Ovest'),('20136','Milano Sud-Ovest'),('20141','Milano Sud-Ovest'),
  ('20142','Milano Sud-Ovest'),('20143','Milano Sud-Ovest'),('20144','Milano Sud-Ovest'),
  ('20146','Milano Sud-Ovest'),
  -- Nord-Ovest: Sempione, Portello, Certosa, Gallaratese, Baggio, Bovisa, Affori
  ('20145','Milano Nord-Ovest'),('20147','Milano Nord-Ovest'),('20148','Milano Nord-Ovest'),
  ('20149','Milano Nord-Ovest'),('20151','Milano Nord-Ovest'),('20152','Milano Nord-Ovest'),
  ('20153','Milano Nord-Ovest'),('20154','Milano Nord-Ovest'),('20155','Milano Nord-Ovest'),
  ('20156','Milano Nord-Ovest'),('20157','Milano Nord-Ovest'),('20158','Milano Nord-Ovest'),
  ('20159','Milano Nord-Ovest'),('20161','Milano Nord-Ovest')
) as c(cap, zname)
join zones z on z.name = c.zname
on conflict (cap) do update set zone_id = excluded.zone_id;

-- 7) Backfill indirizzi esistenti: estrai CAP da street e deriva la zona.
update addresses a
set cap = m.cap
from (select id, substring(street from '(\d{5})') as cap from addresses) m
where a.id = m.id and a.cap is null and m.cap is not null;

update addresses a
set zone_id = zc.zone_id
from zone_caps zc
where a.cap = zc.cap;
