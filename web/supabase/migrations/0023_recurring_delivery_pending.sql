-- 0023 — Orario di consegna preferito + modifiche "in sospeso fino a conferma".
--
-- delivery_hhmm: fascia/orario di consegna preferito (es. "18:00"), indicato dal
--   cliente e onorato dall'ops quando programma la riconsegna. Non genera slot
--   in automatico: è una preferenza.
--
-- pending_*: quando l'admin modifica una ricorrenza, i nuovi valori NON diventano
--   subito effettivi. Restano "proposti" qui finché il cliente non conferma in app;
--   fino ad allora il cron continua a usare i valori effettivi (weekday/hhmm/bags/
--   delivery_hhmm). Alla conferma i pending vengono copiati sugli effettivi.

alter table recurring_pickups add column if not exists delivery_hhmm         text;
alter table recurring_pickups add column if not exists pending_weekday       int;
alter table recurring_pickups add column if not exists pending_hhmm          text;
alter table recurring_pickups add column if not exists pending_bags          int;
alter table recurring_pickups add column if not exists pending_delivery_hhmm text;
