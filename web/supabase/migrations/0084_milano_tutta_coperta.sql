-- Tutta Milano servita: i tre quadranti spenti si accendono
-- ========================================================
--
-- I 38 CAP di Milano stanno in `zone_caps` dalla 0026, mappati sui quattro
-- quadranti. Ma tre quadranti su quattro erano spenti, e `zoneIdForCap` fa una
-- join su `zones.active`: 28 CAP su 38 non risolvevano nessuna zona.
--
-- Il risultato era che tre pezzi del sistema dicevano tre cose diverse sullo
-- stesso CAP. La home, che decide da `copertura.ts`, diceva «siamo nella tua
-- zona»; la mappa operativa non assegnava nessun quadrante; e l'assistente AI,
-- che legge le zone attive, rispondeva «non siamo ancora attivi da lei» — cioe'
-- il contrario di quello che la stessa persona aveva appena letto in home.
--
-- Il rider e' la parte che si romperebbe per prima, ed e' il motivo per cui
-- `courier_id` si scrive qui insieme ad `active`: `scegliRider` copre gli
-- indirizzi senza zona SOLO se tutte le zone attive hanno lo stesso rider.
-- Accendere tre zone lasciandole scoperte spegnerebbe quella clausola, e gli
-- ordini fuori Milano — Arluno, Bollate — nascerebbero senza nessuno assegnato.
-- Meryl copre tutta l'area: deciso da Simone il 1 ottobre 2026.

-- 1. Le quattro zone di Milano: accese, tutte con lo stesso rider.
update public.zones
set active = true,
    courier_id = coalesce(
      courier_id,
      (select courier_id from public.zones where name = 'Milano Sud-Ovest' and courier_id is not null limit 1)
    )
where name in ('Milano Nord-Ovest', 'Milano Nord-Est', 'Milano Sud-Ovest', 'Milano Sud-Est');

-- 2. I lead gia' in casa: zona e copertura ricalcolate.
--    `covered` segue la stessa regola del sito (CAP di Milano o comune servito),
--    non «ha una zona»: sono due domande diverse, ed e' il disallineamento che
--    faceva risultare fuori zona chi arrivava dal funnel.
update public.leads l
set zone_id = zc.zone_id
from public.zone_caps zc
  join public.zones z on z.id = zc.zone_id and z.active
where l.cap = zc.cap
  and l.zone_id is distinct from zc.zone_id;

update public.leads
set covered = true
where covered = false
  and cap is not null
  and (cap = '20100' or cap in ('20089','20090') or cap in (
    '20121','20122','20123','20124','20125','20126','20127','20128','20129',
    '20131','20132','20133','20134','20135','20136','20137','20138','20139',
    '20141','20142','20143','20144','20145','20146','20147','20148','20149',
    '20151','20152','20153','20154','20155','20156','20157','20158','20159',
    '20161','20162'
  ));

-- 3. Gli indirizzi senza quadrante: stesso update della 0026.
update public.addresses a
set zone_id = zc.zone_id
from public.zone_caps zc
  join public.zones z on z.id = zc.zone_id and z.active
where a.cap = zc.cap
  and a.zone_id is null;
