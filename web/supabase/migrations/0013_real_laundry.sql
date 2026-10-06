-- 0013_real_laundry.sql
-- Lavanderia partner REALE. Uso interno (ops, portale /laundry, corriere).
-- NON deve mai essere mostrata ai clienti: l'UI cliente non espone il nome.
-- Idempotente: si può rieseguire senza duplicare.

insert into laundries (name, zone_id, address, active)
select
  'Centro Pulitura Bergamo di Narisi Giuseppe & C. Snc',
  (select id from zones where active order by name limit 1),
  null,
  true
where not exists (
  select 1 from laundries
  where name = 'Centro Pulitura Bergamo di Narisi Giuseppe & C. Snc'
);

-- NB pre-lancio: disattivare le lavanderie di prova così che il routing
-- (PrenotaForm sceglie la prima lavanderia attiva della zona) usi quella reale:
--   update laundries set active = false
--   where name <> 'Centro Pulitura Bergamo di Narisi Giuseppe & C. Snc';
-- (lasciato commentato: da decidere insieme dopo la pulizia dati di prova)
