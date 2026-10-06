-- 0035_zone_caps_hinterland_sud_ovest.sql
-- Estende l'area servita del quadrante Sud-Ovest all'hinterland immediato:
--   20090 → Assago, Buccinasco
--   20089 → Rozzano
-- Sono comuni fuori dal Comune di Milano, ma operativamente stanno sul giro
-- Sud-Ovest: la zona serve al routing del rider, non all'anagrafica comunale.
-- Come sempre in zone_caps, aggiungere o spostare CAP è solo un dato: nessun deploy.

insert into zone_caps (cap, zone_id)
select v.cap, z.id
from (values ('20089'), ('20090')) as v(cap)
join zones z on z.name = 'Milano Sud-Ovest'
on conflict (cap) do update set zone_id = excluded.zone_id;
