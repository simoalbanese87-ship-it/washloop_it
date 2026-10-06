-- 0034_leads_phone_cap_20100.sql
-- 1) Telefono nei lead della landing: il team li richiama, l'email da sola non basta.
-- 2) CAP 20100 nell'area servita (Assago · Buccinasco · Rozzano), mappato al
--    quadrante Sud-Ovest. Riassegnarlo è solo un update su zone_caps: nessun deploy.

alter table leads add column if not exists phone text;

insert into zone_caps (cap, zone_id)
select '20100', z.id from zones z where z.name = 'Milano Sud-Ovest'
on conflict (cap) do update set zone_id = excluded.zone_id;
