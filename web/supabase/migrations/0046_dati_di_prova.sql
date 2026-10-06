-- 0046 — Separare i dati di prova da quelli veri.
--
-- La dashboard diceva 660 € di ricorrente: 440 € erano l'abbonamento di due
-- account di prova (Mario Test 280 €, Cliente Demo 160 €) con il periodo
-- finito rispettivamente il 13 e il 24 luglio. Il calcolo guardava solo
-- `status='active'` e non se il periodo fosse scaduto, e nessuno distingueva
-- un cliente vero da uno inventato per collaudare il giro del rider.
--
-- La scelta è contrassegnarli, non cancellarli: i 5 ordini di Mario Test sono
-- l'unico materiale su cui si può provare il board, lo scanner e la mappa. Con
-- il contrassegno spariscono da numeri ed elenchi, e tornano quando servono.

alter table profiles
  add column if not exists is_test boolean not null default false;

comment on column profiles.is_test is
  'Account di prova: escluso da tutte le metriche e da tutti gli elenchi, salvo interruttore esplicito in admin.';

-- Gli account creati per i collaudi. Elencati per nome e non per id perché la
-- migration deve poter girare anche su un database ricostruito da zero.
update profiles
   set is_test = true
 where role = 'customer'
   and (
     full_name in ('Mario Test', 'Smoke Test', 'Onboard Test', 'Cliente Demo')
     -- I clienti demo generati da createDemoCustomer hanno un'email dedicata.
     or id in (select id from auth.users where email like 'demo.%@washloop.it')
     or id in (select id from auth.users where email like '%.test@washloop.it')
   );

-- Serve a ogni elenco e a ogni metrica: senza, ogni pagina fa un seq scan per
-- filtrare gli account veri.
create index if not exists profiles_is_test_idx on profiles (is_test) where is_test = false;
